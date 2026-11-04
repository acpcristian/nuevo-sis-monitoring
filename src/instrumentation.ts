/**
 * Hook de arranque del servidor (Next.js instrumentation).
 *
 * Se ejecuta una sola vez por proceso cuando el servidor empieza a escuchar.
 * Solo activa el scheduler en runtime Node: los procesos edge no tienen sockets
 * TCP ni Prisma. Tampoco se activa durante `next build`, para que un timer no
 * mantenga vivo el proceso de compilación.
 *
 * Se usa `require` dentro del `if` (patrón documentado por Next.js) en lugar de
 * `import()`: webpack evalúa la condición en tiempo de compilación y no intenta
 * empaquetar el scheduler —ni sus dependencias `node:*`— en el bundle edge.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return;

    const { startServerMonitorScheduler } =
      require("./core/services/server-monitor-scheduler.service") as typeof import("./core/services/server-monitor-scheduler.service");

    startServerMonitorScheduler();
  }
}
