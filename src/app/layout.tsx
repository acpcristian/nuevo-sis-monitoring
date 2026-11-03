import type { Metadata } from "next";
import "./globals.css";
import { ThemeService } from "@/core/services/theme.service";
import { themeVars } from "@/core/domain/theme";

// La apariencia se lee de la BD en cada petición: nunca se sirve un tema obsoleto.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plataforma Empresarial de Monitoreo",
  description: "Monitoreo, análisis de logs y gestión de incidentes de infraestructura",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await ThemeService.getTheme();

  return (
    <html
      lang="es"
      data-theme={theme.mode}
      data-density={theme.density}
      style={themeVars(theme) as React.CSSProperties}
    >
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
