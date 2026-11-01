import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/infrastructure/security/session";

/** Devuelve el usuario de la sesión actual (para el shell de la UI). */
export async function GET(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json(
      { error_code: "UNAUTHORIZED", message: "Sesión no autenticada o expirada." },
      { status: 401 }
    );
  }
  return NextResponse.json(
    { id: session.uid, username: session.username, role: session.role },
    { status: 200 }
  );
}
