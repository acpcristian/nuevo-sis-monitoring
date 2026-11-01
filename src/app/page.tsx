import { redirect } from "next/navigation";

/**
 * Ruta raíz: redirige al inventario de servidores (principal del MVP 001).
 */
export default function HomePage() {
  redirect("/servers");
}
