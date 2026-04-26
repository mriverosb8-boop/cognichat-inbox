import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Lee `conversation_summaries` con el cliente de servidor (service role o anon,
 * ver `getSupabaseServerClient`). Requiere sesión en el inbox.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireSessionUser();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversation_id")?.trim();
    if (!conversationId) {
      return NextResponse.json({ error: "conversation_id es obligatorio" }, { status: 400 });
    }

    console.log("[conversation-summaries] query conversation_id =", conversationId);

    const supabase = getSupabaseServerClient();
    const result = await supabase
      .from("conversation_summaries")
      .select("summary")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    const { data, error: supabaseError, status, statusText } = result;

    const payload = {
      data,
      supabaseError: supabaseError
        ? {
            message: supabaseError.message,
            code: supabaseError.code,
            details: supabaseError.details,
            hint: supabaseError.hint,
          }
        : null,
      supabaseStatus: status,
      supabaseStatusText: statusText,
    };

    console.log("[conversation-summaries] Supabase result (full):", JSON.stringify(payload, null, 2));

    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[conversation-summaries] exception", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
