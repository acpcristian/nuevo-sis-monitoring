import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/infrastructure/security/session.constants";

/**
 * Protección de páginas: si no hay cookie de sesión, redirige a /login.
 * La verificación criptográfica de la sesión ocurre en RSC (layout) y en cada
 * endpoint de la API vía RbacGuard; esto solo evita mostrar la app a bots.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/servers", request.url));
  }

  if (!hasSession) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Todas las páginas excepto api, _next, estáticos y login
    "/((?!api|_next/static|_next/image|favicon.ico|login).*)",
  ],
};
