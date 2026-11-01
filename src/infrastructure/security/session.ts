import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/shared/env";
import { UserRole } from "@/core/domain/server.types";

export const SESSION_COOKIE = "sis_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 horas

export interface SessionPayload {
  uid: string;
  username: string;
  role: UserRole;
  exp: number; // epoch seconds
}

function getAuthSecret(): string {
  const env = getEnv();
  // AUTH_SECRET explícita; fallback determinista derivada de ENCRYPTION_KEY
  return env.AUTH_SECRET ?? `sis-auth:${env.ENCRYPTION_KEY}`;
}

function sign(data: string): string {
  return createHmac("sha256", getAuthSecret()).update(data).digest("base64url");
}

/** Serializa y firma la sesión (HMAC-SHA256). */
export function createSessionToken(
  uid: string,
  username: string,
  role: UserRole,
  now = Date.now()
): string {
  const payload: SessionPayload = {
    uid,
    username,
    role,
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verifica firma y expiración. Devuelve null si la sesión es inválida. */
export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const body = parts[0] as string;
  const signature = parts[1] as string;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload?.uid || !payload?.role || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
