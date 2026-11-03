import { prisma } from "@/infrastructure/db/prisma";
import { AuditService } from "@/core/services/audit.service";
import { resolveTheme, type Theme } from "@/core/domain/theme";

export interface ThemeActor {
  id: string;
  ipAddress?: string | null;
}

export interface ThemeRecord {
  theme: Theme;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface SettingRow {
  preset: string;
  primaryColor: string;
  mode: string;
  radius: number;
  density: string;
  updatedAt: Date;
  updatedBy: string | null;
}

/**
 * Apariencia global del sistema. Se guarda en una fila única (`id = "global"`) y
 * se inyecta como variables CSS desde el layout raíz (sin parpadeo en el cliente).
 */
export class ThemeService {
  private static toTheme(row: SettingRow): Theme {
    return resolveTheme({
      preset: row.preset as Theme["preset"],
      primaryColor: row.primaryColor,
      mode: row.mode === "dark" ? "dark" : "light",
      radius: row.radius,
      density: row.density === "compact" ? "compact" : "comfortable",
    });
  }

  /** Tema vigente; ante cualquier fallo de BD devuelve el tema por defecto. */
  public static async getTheme(): Promise<Theme> {
    const record = await this.getThemeRecord();
    return record.theme;
  }

  public static async getThemeRecord(): Promise<ThemeRecord> {
    try {
      const row = await prisma.systemSetting.findUnique({ where: { id: "global" } });
      if (!row) {
        return { theme: resolveTheme(null), updatedAt: null, updatedBy: null };
      }
      return {
        theme: this.toTheme(row as SettingRow),
        updatedAt: row.updatedAt.toISOString(),
        updatedBy: row.updatedBy,
      };
    } catch (error) {
      // Durante el build o ante una BD no disponible no se debe romper el render.
      console.error("No se pudo leer la apariencia; se usan valores por defecto:", error);
      return { theme: resolveTheme(null), updatedAt: null, updatedBy: null };
    }
  }

  /** Guarda la apariencia y deja evidencia del cambio (antes/después) en auditoría. */
  public static async updateTheme(
    input: Theme,
    actor: ThemeActor
  ): Promise<ThemeRecord> {
    const before = await this.getTheme();
    const next = resolveTheme(input);

    const row = await prisma.systemSetting.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        preset: next.preset,
        primaryColor: next.primaryColor,
        mode: next.mode,
        radius: next.radius,
        density: next.density,
        updatedBy: actor.id,
      },
      update: {
        preset: next.preset,
        primaryColor: next.primaryColor,
        mode: next.mode,
        radius: next.radius,
        density: next.density,
        updatedBy: actor.id,
      },
    });

    await AuditService.recordEvent({
      userId: actor.id,
      action: "THEME_UPDATED",
      detailsDiff: { before, after: next },
      ipAddress: actor.ipAddress ?? null,
    });

    return {
      theme: this.toTheme(row as SettingRow),
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    };
  }
}
