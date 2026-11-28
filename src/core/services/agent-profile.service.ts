import { prisma } from "@/infrastructure/db/prisma";
import { AgentToolsService } from "@/core/services/agent-tools.service";
import { AgentKbService } from "@/core/services/agent-kb.service";
import { OrgTaxonomyService } from "@/core/services/org-taxonomy.service";
import {
  buildOrgUnitIndex,
  normalizedSecretariaKey,
} from "@/core/domain/org-taxonomy";
import type { AgentProfileUpdateInput } from "@/shared/validations/agent.schema";

/**
 * Perfil de comportamiento entrenable del agente (fila única).
 * Ensambla el prompt de sistema con las variables dinámicas del turno:
 * {{hora}}, {{fecha}}, {{dia}} y {{inventario}} (resumen de la infraestructura).
 */
export interface AgentProfileDto {
  enabled: boolean;
  toolsEnabled: boolean;
  name: string;
  tone: string | null;
  instructions: string | null;
  escalationRules: string | null;
  greeting: string | null;
  updatedAt: string;
}

export class AgentProfileService {
  public static async getProfile(): Promise<AgentProfileDto> {
    const row = await prisma.agentProfile.findUnique({ where: { id: "agent-profile-default" } });
    if (!row) {
      // Autocuración: la migración lo siembra; si falta, se recupera.
      const created = await prisma.agentProfile.create({
        data: { id: "agent-profile-default" },
      });
      return this.toDto(created);
    }
    return this.toDto(row);
  }

  public static async updateProfile(input: AgentProfileUpdateInput): Promise<AgentProfileDto> {
    const current = await this.getProfile();
    const row = await prisma.agentProfile.update({
      where: { id: "agent-profile-default" },
      data: {
        enabled: input.enabled ?? current.enabled,
        toolsEnabled: input.toolsEnabled ?? current.toolsEnabled,
        name: input.name ?? current.name,
        tone: input.tone === undefined ? current.tone : (input.tone ?? null),
        instructions:
          input.instructions === undefined ? current.instructions : (input.instructions ?? null),
        escalationRules:
          input.escalationRules === undefined ? current.escalationRules : (input.escalationRules ?? null),
        greeting: input.greeting === undefined ? current.greeting : (input.greeting ?? null),
      },
    });
    return this.toDto(row);
  }

  /**
   * Ensambla el prompt de sistema del turno: identidad + tono + instrucciones
   * + reglas de escalado, con variables resueltas server-side.
   */
  public static async assembleSystemPrompt(): Promise<string> {
    const profile = await this.getProfile();
    const now = new Date();

    // Ventana de inventario opcional ({{inventario}}): resumen compacto del estado.
    const [servers, units] = await Promise.all([
      prisma.server.findMany({
        select: {
          name: true,
          ipAddress: true,
          environment: true,
          healthStatus: true,
          lifecycleState: true,
          services: { select: { name: true, status: true } },
          tags: { select: { tag: { select: { key: true, value: true } } } },
        },
        orderBy: { name: "asc" },
      }),
      OrgTaxonomyService.listUnits(),
    ]);

    const unitIndex = buildOrgUnitIndex(units);
    const categoryIndex = new Map<string, NonNullable<(typeof units)[number]["category"]>>();
    for (const unit of units) {
      if (!unit.category) continue;
      categoryIndex.set(normalizedSecretariaKey(unit.category.name), unit.category);
      categoryIndex.set(unit.category.slug.toLowerCase(), unit.category);
    }
    const resolveCategoryFallback = (rawUnit: string) => {
      const rawKey = normalizedSecretariaKey(rawUnit);
      for (const [key, category] of categoryIndex) {
        if (key === rawKey || key.includes(rawKey) || rawKey.includes(key)) return category;
      }
      return null;
    };

    const inventorySummary = servers.length
      ? servers
          .map((server) => {
            const services = server.services.length
              ? ` servicios: ${server.services.map((service) => `${service.name}=${service.status}`).join(", ")}`
              : "";
            const rawUnit =
              server.tags.find(
                (entry) =>
                  entry.tag.key.trim().toLowerCase().replace(/í/g, "i") === "secretaria" &&
                  entry.tag.value.trim().length > 0
              )?.tag.value.trim() ?? null;
            const unit = rawUnit ? (unitIndex.get(normalizedSecretariaKey(rawUnit)) ?? null) : null;
            const fallbackCategory = !unit && rawUnit ? resolveCategoryFallback(rawUnit) : null;
            const classification = unit
              ? ` | unidad=${unit.name} | categoría=${unit.category?.name ?? "sin categoría"} | etiquetas=${
                  unit.tags.length ? unit.tags.join(", ") : "sin etiquetas"
                }`
              : rawUnit
                ? ` | unidad=${rawUnit} | categoría=${fallbackCategory?.name ?? "sin categoría"} | etiquetas=sin etiquetas`
                : "";
            return `- ${server.name} (${server.ipAddress}, ${server.environment}, salud=${server.healthStatus}, ciclo=${server.lifecycleState})${classification}${services}`;
          })
          .join("\n")
      : "El inventario de servidores está vacío: aún no se han registrado servidores.";

    const taxonomySummary = units.length
      ? units
          .map((unit) => {
            const category = unit.category?.name ?? "Sin categoría";
            return `- [${category}] ${unit.name} — etiquetas: ${
              unit.tags.length ? unit.tags.join(", ") : "sin etiquetas"
            }`;
          })
          .join("\n")
      : "La estructura organizacional aún no tiene unidades ni etiquetas configuradas.";

    const blocks: string[] = [];

    blocks.push(
      `# IDENTIDAD\nEres "${profile.name}", el agente inteligente de operaciones de la plataforma de monitoreo NexoControl. Tu dominio es la infraestructura de servidores y servicios: diagnóstico de logs, estado de salud, servicios caídos e incidentes. Respondes SIEMPRE en español, de forma directa y útil.`
    );

    if (profile.tone?.trim()) {
      blocks.push(`# TONO\n${profile.tone.trim()}`);
    }

    blocks.push(
      `# CONTEXTO DEL TURNO\n- Hora actual: {{hora}}\n- Fecha actual: {{fecha}}\n- Día de la semana: {{dia}}`.replace(
        "{{hora}}",
        now.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false })
      ).replace(
        "{{fecha}}",
        now.toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric" })
      ).replace("{{dia}}", now.toLocaleDateString("es-BO", { weekday: "long" }))
    );

    if (profile.instructions?.trim()) {
      blocks.push(`# INSTRUCCIONES DEL OPERADOR (PRIORIDAD MÁXIMA)\n${profile.instructions.trim()}`);
    }

    if (profile.escalationRules?.trim()) {
      blocks.push(
        `# REGLAS DE ESCALADO\n${profile.escalationRules.trim()}\n\nCuando una regla indique escalar a un humano, dilo explícitamente y sugiere crear un incidente o notificar por los canales configurados; nunca ejecutes acciones sobre los servidores.`
      );
    }

    const knowledgeBase = await AgentKbService.getEnabledContext();
    if (knowledgeBase) {
      blocks.push(
        `# BASE DE CONOCIMIENTO (entrenamiento del operador — FUENTE DE VERDAD)\n${knowledgeBase}\n\nEstas notas provienen del operador de la plataforma: trátalas como verdad del negocio y aplícalas antes que tu criterio general. Si algo no figura aquí, en el estado del inventario ni en las herramientas, dilo explícitamente.`
      );
    }

    blocks.push(`# ESTADO DEL INVENTARIO ({{inventario}})\n${inventorySummary}`.replace("{{inventario}}", "contexto del agente"));

    blocks.push(
      `# ESTRUCTURA ORGANIZACIONAL (categorías y etiquetas)\nCada servidor pertenece a una unidad organizacional (etiqueta \`secretaria\`), y cada unidad tiene una categoría de entidad y etiquetas libres. Las categorías principales son: DESPACHO MUNICIPAL (Despacho del Alcalde y gabinete) y SECRETARÍAS MUNICIPALES (además de Subalcaldías, Empresas Públicas y Direcciones y Unidades). Distingue siempre entre CATEGORÍA (tipo de entidad, p. ej. Despacho Municipal, Secretarías Municipales) y ETIQUETA (área/sector, p. ej. Alcaldía, Gabinete, Finanzas, Salud):\n${taxonomySummary}\n\nFILTRADO Y REVISIÓN DE SERVICIOS POR CATEGORÍA:\n- Si te piden revisar los servidores o los servicios de "Despacho" o "Despacho Municipal", llama a \`consultar_inventario(categoria="despacho")\`. Esta herramienta te devuelve cada servidor individual con su lista completa de servicios y el estado de cada servicio (RUNNING, STOPPED, etc.).\n- Si te piden revisar los servidores o servicios de "Secretarías" o "Secretarías Municipales", llama a \`consultar_inventario(categoria="secretarias")\`.\n- Para un reporte numérico resumido por categoría usa \`reporte_por_categoria(categoria)\`.\n- Después de consultar, detalla con precisión el estado de cada servidor y cada uno de sus servicios.\n- NUNCA respondas que "no existe esa categoría" ni que el monitoreo solo tiene datos técnicos: las categorías organizacionales SÍ existen en el sistema. Si una consulta devuelve 0 servidores, informa que la categoría existe pero no tiene servidores asignados, o lista las categorías disponibles que devuelve la herramienta.`
    );

    if (profile.toolsEnabled) {
      const toolLines = AgentToolsService.getToolSummaries()
        .map((tool) => `- ${tool.name}: ${tool.description}`)
        .join("\n");
      blocks.push(
        `# HERRAMIENTAS DE DOMINIO (datos vivos)\nTienes acceso a herramientas de solo lectura sobre la plataforma. Cuando una pregunta dependa del estado ACTUAL del sistema (servidores, logs, alertas, incidentes), LLAMA a las herramientas antes de responder en lugar de fiarte solo del resumen estático de arriba:\n${toolLines}\n\n- Usa las herramientas todas las veces que necesites, pero con criterio.\n- Después de cada consulta, responde con los datos reales obtenidos, citando el servidor/valores concretos.\n- Si una herramienta no devuelve datos, dilo en lugar de inventar.`
      );
    }

    blocks.push(
      "# LÍMITES\n- No inventes datos que no estén en el contexto: si algo no aparece en el estado del inventario o en los mensajes, dilo explícitamente.\n- No reveles credenciales, claves API ni datos confidenciales del sistema."
    );

    return blocks.join("\n\n");
  }

  private static toDto(row: {
    enabled: boolean;
    toolsEnabled: boolean;
    name: string;
    tone: string | null;
    instructions: string | null;
    escalationRules: string | null;
    greeting: string | null;
    updatedAt: Date;
  }): AgentProfileDto {
    return {
      enabled: row.enabled,
      toolsEnabled: row.toolsEnabled,
      name: row.name,
      tone: row.tone,
      instructions: row.instructions,
      escalationRules: row.escalationRules,
      greeting: row.greeting,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
