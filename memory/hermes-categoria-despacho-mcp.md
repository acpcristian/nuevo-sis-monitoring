---
type: project
title: Hermes respondía "no existe esa categoría" — causa raíz y reparación (Despacho)
date: 2026-11-28
---

## Síntoma
En Telegram, al pedir "Hermes, muéstrame los servidores asignados a Despacho y qué servicios…",
el agente respondía: "No existe esa categoría en el monitoreo. Solo datos técnicos:
nombre, IP, salud, servicios."

## Causas raíz (dos, encadenadas)
1. **Los filtros del MCP se descartaban.** `AgentToolsService.execute(name, rawArgs)` solo
   parseaba `rawArgs` cuando era un string JSON. El servidor MCP (`mcp.service.ts`) ya entrega
   `params.arguments` como **objeto**, así que `args` quedaba `{}` y
   `consultar_inventario(categoria="despacho")` devolvía TODO el inventario sin filtrar.
   El chat web no lo sufría porque `llm-chat.service.ts` pasa `call.arguments` como string.
2. **Despacho Municipal no existía en la BD.** La migración `20261118000000_org_taxonomy`
   solo sembró 4 categorías (sin `despacho`). `OrgTaxonomyService.ensureSeed()` solo sembraba
   si la tabla estaba **vacía**, así que en bases ya existentes (dev y producción) nunca se
   agregó la categoría ni la unidad DESPACHO MUNICIPAL. Resultado: aunque el filtro llegara,
   no había categoría que mapear.

## Reparación (commit `5019876`, desplegado en Coolify)
- `execute()` acepta argumentos como objeto además de string JSON (causa raíz 1).
- `ensureSeed()` ahora es **aditivo**: crea categorías/unidades del catálogo que falten sin
  sobrescribir ediciones. Al primer request, producción creó `despacho` + `DESPACHO MUNICIPAL`.
- Migración de paridad `20261128000000_org_despacho_seed` (idempotente).
- Fallback: si la etiqueta `secretaria` no coincide con una unidad, se resuelve la categoría
  por nombre (p. ej. tag "Despacho" → categoría "Despacho Municipal").
- Las tools, cuando un filtro devuelve 0, listan `categorias_disponibles` y el prompt prohíbe
  afirmar que la categoría no existe.
- Test de regresión: `tests/unit/services/agent-tools-args.test.ts`.

## Verificación en vivo (2026-11-28)
- `GET /api/v1/org-categories` → `despacho | Despacho Municipal | unitCount=1`.
- `GET /api/v1/secretarias` → DESPACHO MUNICIPAL con 1 servidor (`repo-img`; `SIGET` retirado).
- `tools/call consultar_inventario {"categoria":"despacho"}` vía MCP → 2 servidores con su
  lista de servicios y `categoria: "Despacho Municipal"`. Clave temporal revocada después.

## Notas de operación
- El dominio del panel (`panel.elalto.gob.bo`) devuelve **503**, pero la API de Coolify
  responde en **`http://172.16.100.22:8000`** (usar esa base para deploy/consultas).
- La app se sirve por **HTTP** (`http://nexocontrol.elalto.gob.bo`); por HTTPS devuelve 503
  porque el FQDN está configurado sin TLS.
- El healthcheck del contenedor usa `curl`, que no existe en la imagen (`curl: not found`)
  y aun así reporta exit 0 → contenedores "healthy" falsos. Pendiente de corregir.
