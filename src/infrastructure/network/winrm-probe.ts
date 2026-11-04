import { CheckResultStatus } from "@/core/domain/server.types";
import { ProbeResult } from "./ssh-probe";
import { TcpProbe } from "./tcp-probe";

export interface WinrmProbeParams {
  host: string;
  port: number;
  timeoutMs?: number;
}

export class WinrmProbe {
  /**
   * Comprobación de conectividad TCP sobre el puerto WinRM (5986/5985) o el
   * servicio de agente de Windows Server. Delega en `TcpProbe` para compartir
   * la lógica de timeouts y clasificación de errores de red.
   */
  public static async probe(params: WinrmProbeParams): Promise<ProbeResult> {
    const result = await TcpProbe.probe({
      host: params.host,
      port: params.port || 5986,
      timeoutMs: params.timeoutMs ?? 5000,
    });

    return {
      status: result.status as CheckResultStatus,
      durationMs: result.durationMs,
      diagnosticSummary: result.diagnosticSummary,
    };
  }
}
