import crypto from "node:crypto";
import { getEnv } from "@/shared/env";

export interface EncryptedSecretData {
  encryptedPayload: string;
  iv: string;
  authTag: string;
  keyFingerprint?: string;
}

export class SecretVault {
  private static getMasterKey(): Buffer {
    const hexKey = getEnv().ENCRYPTION_KEY;
    if (hexKey.length !== 64) {
      throw new Error("ENCRYPTION_KEY inválida: debe tener 32 bytes (64 caracteres hexadecimales).");
    }
    return Buffer.from(hexKey, "hex");
  }

  /**
   * Cifra un secreto en texto plano usando AES-256-GCM.
   * Genera un IV criptográficamente aleatorio de 12 bytes para cada invocación.
   */
  public static encryptSecret(plainText: string, keyTypeHint?: string): EncryptedSecretData {
    if (!plainText || plainText.trim().length === 0) {
      throw new Error("El secreto a cifrar no puede estar vacío.");
    }

    const masterKey = this.getMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);

    let encrypted = cipher.update(plainText, "utf8", "base64");
    encrypted += cipher.final("base64");
    const authTag = cipher.getAuthTag();

    // Cálculo de huella digital pública (SHA-256 truncado para identificación no sensible)
    const keyFingerprint = this.generateFingerprint(plainText);

    return {
      encryptedPayload: encrypted,
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      keyFingerprint,
    };
  }

  /**
   * Descifra un payload cifrado con AES-256-GCM.
   * Valida la autenticidad e integridad del payload mediante el authTag.
   */
  public static decryptSecret(encryptedPayload: string, ivBase64: string, authTagBase64: string): string {
    const masterKey = this.getMasterKey();
    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");

    if (iv.length !== 12) {
      throw new Error("Vector de inicialización (IV) inválido: se requieren 12 bytes.");
    }
    if (authTag.length !== 16) {
      throw new Error("Tag de autenticación inválido: se requieren 16 bytes.");
    }

    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedPayload, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  /**
   * Genera una huella pública SHA-256 legible (e.g. SHA256:abcd1234...) para que
   * el operador pueda verificar la identidad de la credencial sin exponerla.
   */
  public static generateFingerprint(data: string): string {
    const hash = crypto.createHash("sha256").update(data.trim()).digest("hex");
    return `SHA256:${hash.substring(0, 16)}...${hash.substring(hash.length - 8)}`;
  }
}

