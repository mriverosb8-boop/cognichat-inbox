import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/require-user";
import { buildHotelWhatsappByIdMap } from "@/lib/hotel-whatsapp-map";
import {
  buildMessageFromWubbyRow,
  mergeConversationsTableWithMessages,
  normalizePhoneDigits,
  resolveHotelWaIdentitiesSet,
} from "@/lib/chat-utils";
import { CONVERSATIONS_TABLE, type ConversationDbRow } from "@/lib/conversation-schema";
import { MESSAGES_LIMIT } from "@/lib/message-limits";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { WUBBY_TABLE, type WubbyWhatsappRow } from "@/lib/wubby-schema";

export const dynamic = "force-dynamic";

const HOTEL_PHONE = "573002422890";

export async function GET(request: Request) {
  try {
    const auth = await requireSessionUser();
    if (auth.response) return auth.response;

    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId")?.trim();
    const guestPhoneRaw = url.searchParams.get("guestPhone")?.trim();
    const guestPhone = normalizePhoneDigits(guestPhoneRaw);

    if (!conversationId && !guestPhone) {
      return NextResponse.json({ error: "conversationId o guestPhone es obligatorio" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    if (!conversationId) {
      const hotelPhone = normalizePhoneDigits(HOTEL_PHONE);
      const { data, error } = await supabase
        .from(WUBBY_TABLE)
        .select("*")
        .or(
          `and(sender.eq.${guestPhone},recipient.eq.${hotelPhone}),and(sender.eq.${hotelPhone},recipient.eq.${guestPhone})`
        )
        .order("created_at", { ascending: false })
        .limit(MESSAGES_LIMIT);

      if (error) {
        console.error("[reservas messages GET] phone fallback", error);
        return NextResponse.json({ error: error.message }, { status: 502 });
      }

      const rows = ((data ?? []) as WubbyWhatsappRow[]).reverse();
      const hotelIdentities = resolveHotelWaIdentitiesSet({ extraCsvEnv: hotelPhone });
      const messages = rows.map(
        (row) => buildMessageFromWubbyRow(row, `+${guestPhone}`, hotelIdentities).message
      );

      return NextResponse.json({
        conversation: null,
        messages,
        messageLimit: MESSAGES_LIMIT,
      });
    }

    const [convResult, msgResult] = await Promise.all([
      supabase.from(CONVERSATIONS_TABLE).select("*").eq("id", conversationId).single(),
      supabase
        .from(WUBBY_TABLE)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(MESSAGES_LIMIT),
    ]);

    if (convResult.error) {
      console.error("[reservas messages GET] conversation", convResult.error);
      return NextResponse.json({ error: convResult.error.message }, { status: 502 });
    }
    if (msgResult.error) {
      console.error("[reservas messages GET] messages", msgResult.error);
      return NextResponse.json({ error: msgResult.error.message }, { status: 502 });
    }

    const { data: hotelRows } = await supabase.from("hotels").select("id, whatsapp_number");
    const hotelWhatsappById = buildHotelWhatsappByIdMap(hotelRows ?? []);

    const conversations = mergeConversationsTableWithMessages(
      [convResult.data as ConversationDbRow],
      ((msgResult.data ?? []) as WubbyWhatsappRow[]).reverse(),
      {
        hotelWhatsappById,
        messageLimit: MESSAGES_LIMIT,
      }
    );

    return NextResponse.json({
      conversation: conversations[0] ?? null,
      messages: conversations[0]?.messages ?? [],
      messageLimit: MESSAGES_LIMIT,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    console.error("[reservas messages GET]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
