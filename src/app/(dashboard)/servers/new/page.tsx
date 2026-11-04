"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ServerForm } from "@/components/servers/ServerForm";
import { emitCatalogChange } from "@/lib/catalog-events";

export default function NewServerPage() {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6">
        <Link
          href="/servers"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Inventario
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Alta de Servidor</h1>
        <p className="text-sm text-slate-500 mt-1">
          Incorpora un nuevo servidor físico o virtual al sistema de observabilidad.
        </p>
      </div>

      <ServerForm
        onSuccess={() => {
          // Notifica al catálogo para que refresque en tiempo real sin esperar
          // a la navegación dura (que Next.js puede cachear).
          emitCatalogChange();
          router.push("/servers");
        }}
        onCancel={() => router.push("/servers")}
      />
    </div>
  );
}

