import { prisma } from "@/infrastructure/db/prisma";
import { AgentToolsService } from "@/core/services/agent-tools.service";
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
    const servers = await prisma.server.findMany({
      select: {
        name: true,
        ipAddress: true,
        environment: true,
        healthStatus: true,
        lifecycleState: true,
        services: { select: { name: true, status: true } },
      },
      orderBy: { name: "asc" },
    });

    const inventorySummary = servers.length
      ? servers
          .map((server) => {
            const services = server.services.length
              ? ` servicios: ${server.services.map((service) => `${service.name}=${service.status}`).join(", ")}`
              : "";
            return `- ${server.name} (${server.ipAddress}, ${server.environment}, salud=${server.healthStatus}, ciclo=${server.lifecycleState})${services}`;
          })
          .join("\n")
      : "El inventario de servidores está vacío: aún no se han registrado servidores.";

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

    blocks.push(`# ESTADO DEL INVENTARIO ({{inventario}})\n${inventorySummary}`.replace("{{inventario}}", "contexto del agente"));

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
