/**
 * Punto de entrada del cliente servidor Supabase.
 * Solo importar desde Route Handlers, Server Actions o `server-only` components:
 * la service role no debe acabar en el bundle del cliente.
 */
export { getSupabaseServerClient } from "@/lib/supabase-server";
