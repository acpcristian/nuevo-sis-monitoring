import crypto from "node:crypto";
import { prisma } from "@/infrastructure/db/prisma";
import { SecretVault } from "@/infrastructure/crypto/secret-vault";
import { AuditService } from "@/core/services/audit.service";
import { NotFoundError, ConflictError } from "@/shared/errors/domain-errors";

/**
 * Claves de API de servicio para integraciones de agentes externos (Hermes → MCP).
 *
 * Reglas de seguridad:
 *  - La clave en claro (`nxs_<hex>`) se genera una vez y NUNCA se vuelve a leer:
 *    solo se persiste su hash SHA-256. Comparación en tiempo constante.
 *  - El listado expone únicamente la huella (fingerprint) para que el operador
 *    verifique la identidad de la credencial (Principio III).
 */
export interface ServiceKeyPresenter {
  id: string;
  name: string;
  fingerprint: string;
  status: "ACTIVE" | "REVOKED";
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export interface ServiceKeyCreated {
  /** Clave en claro — SOLO se devuelve en la respuesta del POST de creación. */
  key: string;
  record: ServiceKeyPresenter;
}

export class IntegrationKeyService {
  private static hashKey(key: string): string {
    return crypto.createHash("sha256").update(key).digest("hex");
  }

  private static present(row: {
    id: string;
    name: string;
    fingerprint: string;
    status: string;
    scopes: string[];
    lastUsedAt: Date | null;
    createdAt: Date;
  }): ServiceKeyPresenter {
    return {
      id: row.id,
      name: row.name,
      fingerprint: row.fingerprint,
      status: row.status as ServiceKeyPresenter["status"],
      scopes: row.scopes,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Crea una clave nueva y devuelve la clave en claro una única vez. */
  public static async createKey(
    input: { name: string; scopes?: string[] },
    userId: string,
    ipAddress?: string | null
  ): Promise<ServiceKeyCreated> {
    const existing = await prisma.serviceApiKey.findUnique({ where: { name: input.name } });
    if (existing) {
      throw new ConflictError(`Ya existe una clave de servicio con el nombre "${input.name}".`);
    }

    const key = `nxs_${crypto.randomBytes(24).toString("hex")}`;
    const created = await prisma.serviceApiKey.create({
      data: {
        name: input.name,
        keyHash: this.hashKey(key),
        fingerprint: SecretVault.generateFingerprint(key),
        status: "ACTIVE",
        scopes: input.scopes ?? ["mcp:read", "mcp:create_incident"],
        createdBy: userId,
      },
    });

    await AuditService.recordEvent({
      userId,
      action: "API_KEY_CREATED",
      detailsDiff: { keyId: created.id, name: created.name, scopes: created.scopes },
      ipAddress: ipAddress ?? null,
    });

    return { key, record: this.present(created) };
  }

  public static async listKeys(): Promise<ServiceKeyPresenter[]> {
    const rows = await prisma.serviceApiKey.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((r) => this.present(r));
  }

  public static async revokeKey(id: string, userId: string, ipAddress?: string | null): Promise<void> {
    const key = await prisma.serviceApiKey.findUnique({ where: { id } });
    if (!key) {
      throw new NotFoundError("Clave de servicio");
    }
    await prisma.serviceApiKey.update({ where: { id }, data: { status: "REVOKED" } });

    await AuditService.recordEvent({
      userId,
      action: "API_KEY_REVOKED",
      detailsDiff: { keyId: id, name: key.name },
      ipAddress: ipAddress ?? null,
    });
  }

  /**
   * Verifica una clave Bearer en claro contra el hash almacenado.
   * Devuelve la fila si está activa, o `null` si no coincide / está revocada.
   */
  public static async verifyKey(plaintextKey: string): Promise<{ id: string; name: string; scopes: string[] } | null> {
    const hash = this.hashKey(plaintextKey);
    const row = await prisma.serviceApiKey.findUnique({ where: { keyHash: hash } });
    if (!row || row.status !== "ACTIVE") {
      return null;
    }

    // Auditoría de uso sin bloquear la respuesta (fire-and-forget).
    void prisma.serviceApiKey
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return { id: row.id, name: row.name, scopes: row.scopes };
  }
}
