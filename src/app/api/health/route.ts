import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";

/**
 * Healthcheck ligero para Coolify.
 * GET /api/health → 200 {status:"ok"} (sin coste de DB pesada; solo SELECT 1)
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[health] db no accesible:", error);
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
