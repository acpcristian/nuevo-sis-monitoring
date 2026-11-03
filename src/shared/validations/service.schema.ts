import { z } from "zod";

export const ServiceStatus = z.enum(["RUNNING", "STOPPED", "ERROR", "UNKNOWN"]);

export const CreateServiceSchema = z.object({
  serverId: z.string().min(1, "serverId requerido"),
  name: z.string().min(1, "El nombre es requerido").max(100),
  description: z.string().max(500).optional(),
  port: z.coerce.number().min(1).max(65535).optional(),
  endpoint: z.string().url().optional(),
  processName: z.string().max(200).optional(),
});

export const UpdateServiceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  port: z.coerce.number().min(1).max(65535).optional(),
  endpoint: z.string().url().optional(),
  processName: z.string().max(200).optional(),
});

export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>;