/** Bandeja: GET fusiona `conversations` + mensajes `Wubby_Whatsapp`; PATCH actualiza solo `conversations`. */
import { NextResponse } from "next/server";
import { mergeConversationsTableWithMessages } from "@/lib/chat-utils";
import {
  CONVERSATIONS_TABLE,
  type ConversationDbRow,
  type InboxPatchAction,
} from "@/lib/conversation-schema";
import type { WubbyWhatsappRow } from "@/lib/wubby-schema";
import { WUBBY_TABLE } from "@/lib/wubby-schema";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const MESSAGE_FETCH_LIMIT = 8000;

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    const [convResult, msgResult] = await Promise.all([
      supabase.from(CONVERSATIONS_TABLE).select("*").order("updated_at", { ascending: false }),
      supabase
        .from(WUBBY_TABLE)
        .select("*")
        .order("created_at", { ascending: true })
        .limit(MESSAGE_FETCH_LIMIT),
    ]);

    if (convResult.error) {
      console.error("[inbox GET] conversations", convResult.error);
      return NextResponse.json({ error: convResult.error.message }, { status: 502 });
    }
    if (msgResult.error) {
      console.error("[inbox GET] messages", msgResult.error);
      return NextResponse.json({ error: msgResult.error.message }, { status: 502 });
    }

    const convRows = (convResult.data ?? []) as ConversationDbRow[];
    const msgRows = (msgResult.data ?? []) as WubbyWhatsappRow[];

    const conversations = mergeConversationsTableWithMessages(convRows, msgRows, {
      twilioEnv: process.env.TWILIO_WHATSAPP_ADDRESS,
    });

    return NextResponse.json({
      conversations,
      fetchedConversations: convRows.length,
      fetchedMessages: msgRows.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[inbox GET]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      conversationId?: string;
      action?: InboxPatchAction;
    };

    const conversationId = body.conversationId?.trim();
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId es obligatorio" }, { status: 400 });
    }

    const action = body.action;
    if (
      action !== "human_control" &&
      action !== "reactivate_ai" &&
      action !== "completed"
    ) {
      return NextResponse.json(
        { error: "action debe ser human_control, reactivate_ai o completed" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    let patch: Record<string, unknown> = { updated_at: now };

    switch (action) {
      case "human_control":
        patch = {
          ...patch,
          needs_human: true,
          ai_active: false,
          status: "human_control",
        };
        break;
      case "reactivate_ai":
        patch = {
          ...patch,
          needs_human: false,
          ai_active: true,
          status: "open",
        };
        break;
      case "completed":
        patch = {
          ...patch,
          status: "completed",
        };
        break;
      default:
        return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from(CONVERSATIONS_TABLE).update(patch).eq("id", conversationId);

    if (error) {
      console.error("[inbox PATCH]", error);
      return NextResponse.json(
        {
          error: error.message || "No se pudo actualizar la conversación",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, conversationId, action });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
