import { describe, it, expect } from "vitest";
import { SecretVault } from "@/infrastructure/crypto/secret-vault";

describe("SecretVault (AES-256-GCM Enterprise Crypto)", () => {
  const sampleSshKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn
NhAAAAAwEAAQAAAYEA0123456789...test-mock-key...
-----END OPENSSH PRIVATE KEY-----`;

  it("debe cifrar y descifrar un secreto correctamente preservando su contenido exacto", () => {
    const encrypted = SecretVault.encryptSecret(sampleSshKey);

    expect(encrypted.encryptedPayload).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.keyFingerprint).toMatch(/^SHA256:[a-f0-9]{16}\.\.\.[a-f0-9]{8}$/);

    const decrypted = SecretVault.decryptSecret(
      encrypted.encryptedPayload,
      encrypted.iv,
      encrypted.authTag
    );

    expect(decrypted).toBe(sampleSshKey);
  });

  it("debe generar vectores de inicialización (IV) únicos e impredecibles en cada invocación", () => {
    const enc1 = SecretVault.encryptSecret("mismo-secreto");
    const enc2 = SecretVault.encryptSecret("mismo-secreto");

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.encryptedPayload).not.toBe(enc2.encryptedPayload);
  });

  it("debe rechazar el descifrado si el payload cifrado ha sido manipulado (Tampering Protection)", () => {
    const encrypted = SecretVault.encryptSecret("contraseña-super-segura");

    // Alterar un byte del payload
    const tamperedPayload = Buffer.from(encrypted.encryptedPayload, "base64");
    tamperedPayload[0] = (tamperedPayload[0] ?? 0) ^ 0xff;

    expect(() => {
      SecretVault.decryptSecret(
        tamperedPayload.toString("base64"),
        encrypted.iv,
        encrypted.authTag
      );
    }).toThrow();
  });

  it("debe rechazar el descifrado si el tag de autenticación ha sido adulterado", () => {
    const encrypted = SecretVault.encryptSecret("secreto");

    const tamperedTag = Buffer.from(encrypted.authTag, "base64");
    tamperedTag[0] = (tamperedTag[0] ?? 0) ^ 0xff;

    expect(() => {
      SecretVault.decryptSecret(
        encrypted.encryptedPayload,
        encrypted.iv,
        tamperedTag.toString("base64")
      );
    }).toThrow();
  });

  it("debe fallar con error descriptivo si se intenta cifrar un texto vacío", () => {
    expect(() => SecretVault.encryptSecret("")).toThrow("El secreto a cifrar no puede estar vacío.");
    expect(() => SecretVault.encryptSecret("   ")).toThrow("El secreto a cifrar no puede estar vacío.");
  });

  it("debe generar huella digital determinista y pública para la misma entrada", () => {
    const fp1 = SecretVault.generateFingerprint("clave-prueba");
    const fp2 = SecretVault.generateFingerprint("clave-prueba");
    const fp3 = SecretVault.generateFingerprint("otra-clave");

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
  });
});

