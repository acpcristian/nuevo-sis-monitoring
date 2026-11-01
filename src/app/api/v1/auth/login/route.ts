import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/core/services/auth.service";
import { DomainError } from "@/shared/errors/domain-errors";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/infrastructure/security/session";

export async function POST(request: NextRequest) {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "127.0.0.1";

    const body = await request.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { error_code: "VALIDATION_ERROR", message: "Usuario y contraseña son obligatorios." },
        { status: 422 }
      );
    }

    const result = await AuthService.login(username, password, ipAddress);
    if (!result) {
      return NextResponse.json(
        { error_code: "INVALID_CREDENTIALS", message: "Credenciales inválidas o usuario inactivo." },
        { status: 401 }
      );
    }

    const response = NextResponse.json(
      { user: result.user },
      { status: 200 }
    );
    response.cookies.set({
      name: SESSION_COOKIE,
      value: result.token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
      // No se fuerza `secure` porque el despliegue institucional sirve HTTP en la red interna (sslip.io).
    });
    return response;
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al iniciar sesión." },
      { status: 500 }
    );
  }
}
