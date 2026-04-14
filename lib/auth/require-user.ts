import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Valida sesión en Route Handlers (cookies). Tras esto puedes usar
 * `getSupabaseServerClient()` para datos con service role / anon de servidor.
 */
export async function requireSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null as null,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  return { user, response: null as null };
}
