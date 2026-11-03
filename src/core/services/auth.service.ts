import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { prisma } from "@/infrastructure/db/prisma";
import { createSessionToken } from "@/infrastructure/security/session";
import { getEnv } from "@/shared/env";
import { AuditService } from "@/core/services/audit.service";
import type { UserRole } from "@/core/domain/server.types";

const scrypt = promisify(scryptCb);

const SCRYPT_KEYLEN = 64;

/** Hash de contraseña con scrypt (N=16384 por defecto de Node). Formato: scrypt$<salt hex>$<hash hex>. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const derived = (await scrypt(password, Buffer.from(saltHex, "hex"), SCRYPT_KEYLEN)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

export interface AuthResult {
  token: string;
  user: { id: string; username: string; displayName: string | null; role: UserRole };
}

export class AuthService {
  /**
   * Garantiza la existencia del SUPERADMIN semilla (solo primera vez, idempotente).
   * Credenciales provienen de SUPERADMIN_USER / SUPERADMIN_PASSWORD.
   */
  public static async ensureSeedSuperadmin(): Promise<void> {
    const username = getEnv().SUPERADMIN_USER ?? "admin";
    const password = getEnv().SUPERADMIN_PASSWORD ?? "Cambiar Esta Contraseña";

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return;

    await prisma.user.create({
      data: {
        username,
        displayName: "Administrador del Sistema",
        role: "SUPERADMIN",
        passwordHash: await hashPassword(password),
        isActive: true,
      },
    });
  }

  /**
   * Autentica por usuario+contraseña; registra éxito/fallo en auditoría.
   * Devuelve el token de sesión firmado o null si las credenciales son inválidas.
   */
  public static async login(
    username: string,
    password: string,
    ipAddress?: string | null
  ): Promise<AuthResult | null> {
    await this.ensureSeedSuperadmin();

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !user.isActive) {
      await AuditService.recordEvent({
        userId: "anonimo",
        action: "LOGIN_FAILED",
        detailsDiff: { username, reason: user ? "inactivo" : "inexistente" },
        ipAddress: ipAddress ?? null,
      });
      return null;
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      // Break-glass operativo: si la contraseña coincide con SUPERADMIN_PASSWORD del
      // entorno, se re-sincroniza el hash (rotación determinista tras un despliegue).
      const env = getEnv();
      const envUser = env.SUPERADMIN_USER ?? "admin";
      const envPassword = env.SUPERADMIN_PASSWORD;
      const isEnvSuperadmin =
        Boolean(envPassword) &&
        user.username === envUser &&
        user.role === "SUPERADMIN" &&
        password === envPassword;

      if (isEnvSuperadmin) {
        const newHash = await hashPassword(password);
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash, lastLoginAt: new Date() },
        });
        await AuditService.recordEvent({
          userId: user.id,
          action: "USER_UPDATED",
          detailsDiff: { username, reason: "superadmin password resincronizada desde entorno" },
          ipAddress: ipAddress ?? null,
        });
        return {
          token: createSessionToken(user.id, user.username, user.role),
          user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
        };
      }

      await AuditService.recordEvent({
        userId: user.id,
        action: "LOGIN_FAILED",
        detailsDiff: { username },
        ipAddress: ipAddress ?? null,
      });
      return null;
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await AuditService.recordEvent({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      detailsDiff: { username },
      ipAddress: ipAddress ?? null,
    });

    return {
      token: createSessionToken(user.id, user.username, user.role),
      user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
    };
  }
}
