import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import AgentPageClient from "@/components/agent/AgentPageClient";

export const metadata: Metadata = {
  title: "Agente Inteligente · NexoControl",
};

export default function AgentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando agente…
        </div>
      }
    >
      <AgentPageClient />
    </Suspense>
  );
}
