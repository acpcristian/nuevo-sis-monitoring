import { NextRequest, NextResponse } from "next/server";
import { PlaybookService } from "@/core/services/playbook.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

export async function GET(request: NextRequest) {
  try {
    RbacGuard.extractUser(request);
    const result = await PlaybookService.listPlaybooks();
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en GET /api/v1/playbooks:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al listar playbooks." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = RbacGuard.extractUser(request);
    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede crear playbooks." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, trigger, steps } = body ?? {};

    if (typeof name !== "string" || name.trim().length < 3) {
      return NextResponse.json(
        { error_code: "VALIDATION_ERROR", message: "name es obligatorio (mínimo 3 caracteres)." },
        { status: 422 }
      );
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error_code: "VALIDATION_ERROR", message: "steps debe ser una lista con al menos un paso." },
        { status: 422 }
      );
    }

    const created = await PlaybookService.createPlaybook(
      { name: name.trim(), description, trigger, steps },
      user.id,
      user.ipAddress
    );
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en POST /api/v1/playbooks:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al crear el playbook." }, { status: 500 });
  }
}
