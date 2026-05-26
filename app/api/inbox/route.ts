/** Bandeja: GET fusiona `conversations` + mensajes `Wubby_Whatsapp`; PATCH actualiza solo `conversations`. */
import { NextResponse } from "next/server";
import { getConversationDisplayActivityMs, mergeConversationsTableWithMessages } from "@/lib/chat-utils";
import {
  buildHotelWhatsappByIdMap,
  hotelWhatsappMapToRecord,
} from "@/lib/hotel-whatsapp-map";
import {
  CONVERSATIONS_TABLE,
  type ConversationDbRow,
  type InboxPatchAction,
} from "@/lib/conversation-schema";
import type { WubbyWhatsappRow } from "@/lib/wubby-schema";
import { WUBBY_TABLE } from "@/lib/wubby-schema";
import { requireSessionUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { MESSAGE_FETCH_LIMIT, MESSAGES_LIMIT } from "@/lib/message-limits";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const HOTEL_USERS_TABLE = "hotel_users";
const HOTELS_TABLE = "hotels";

type AvailableHotel = {
  id: string;
  name: string;
};

function emptyInboxResponse(availableHotels: AvailableHotel[] = [], activeHotelId: string | null = null) {
  return NextResponse.json({
    conversations: [],
    fetchedConversations: 0,
    fetchedMessages: 0,
    messageLimit: MESSAGES_LIMIT,
    availableHotels,
    activeHotelId,
    hotelWhatsappById: {},
  });
}

async function resolveAllowedHotelIds(
  supabase: SupabaseClient,
  user: User
): Promise<string[]> {
  const { data: membershipRows, error: membershipError } = await supabase
    .from(HOTEL_USERS_TABLE)
    .select("hotel_id, role")
    .eq("user_id", user.id);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const rows = membershipRows ?? [];
  const isSuperAdmin = rows.some((row) => String(row.role ?? "").trim() === "super_admin");

  if (isSuperAdmin) {
    const { data: hotelRows, error: hotelsError } = await supabase.from(HOTELS_TABLE).select("id");
    if (hotelsError) {
      throw new Error(hotelsError.message);
    }
    return (hotelRows ?? []).map((row) => String(row.id)).filter(Boolean);
  }

  const allowedHotelIds = new Set<string>();
  for (const row of rows) {
    if (row.hotel_id != null) {
      allowedHotelIds.add(String(row.hotel_id));
    }
  }
  return [...allowedHotelIds];
}

async function resolveAvailableHotels(
  supabase: SupabaseClient,
  allowedHotelIds: string[]
): Promise<AvailableHotel[]> {
  if (allowedHotelIds.length === 0) return [];

  const { data: hotelRows, error } = await supabase
    .from(HOTELS_TABLE)
    .select("id, name")
    .eq("is_active", true)
    .in("id", allowedHotelIds)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (hotelRows ?? [])
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? row.id),
    }))
    .filter((row) => row.id);
}

function resolveActiveHotelId(
  requestedHotelId: string,
  allowedHotelIds: string[],
  availableHotels: AvailableHotel[]
): { activeHotelId: string | null; forbidden: boolean } {
  if (requestedHotelId) {
    if (!allowedHotelIds.includes(requestedHotelId)) {
      return { activeHotelId: null, forbidden: true };
    }
    return { activeHotelId: requestedHotelId, forbidden: false };
  }

  if (availableHotels.length === 0) {
    return { activeHotelId: null, forbidden: false };
  }

  return { activeHotelId: availableHotels[0]!.id, forbidden: false };
}

export async function GET(request: Request) {
  try {
    const auth = await requireSessionUser();
    if (auth.response) return auth.response;

    const supabase = getSupabaseServerClient();
    const allowedHotelIds = await resolveAllowedHotelIds(supabase, auth.user);
    const requestedHotelId = new URL(request.url).searchParams.get("hotelId")?.trim() ?? "";
    const availableHotels = await resolveAvailableHotels(supabase, allowedHotelIds);
    const { activeHotelId, forbidden } = resolveActiveHotelId(
      requestedHotelId,
      allowedHotelIds,
      availableHotels
    );

    console.log("[inbox GET] tenant access", {
      userId: auth.user.id,
      email: auth.user.email,
      allowedHotelIds,
      availableHotels,
      activeHotelId,
      requestedHotelId: requestedHotelId || null,
    });

    if (forbidden) {
      return NextResponse.json({ error: "No autorizado para ver este hotel" }, { status: 403 });
    }

    if (allowedHotelIds.length === 0 || !activeHotelId) {
      return emptyInboxResponse(availableHotels, activeHotelId);
    }

    const { data: hotelWaRows, error: hotelWaError } = await supabase
      .from(HOTELS_TABLE)
      .select("id, whatsapp_number")
      .in("id", allowedHotelIds);

    if (hotelWaError) {
      console.error("[inbox GET] hotels whatsapp", hotelWaError);
      return NextResponse.json({ error: hotelWaError.message }, { status: 502 });
    }

    const hotelWhatsappById = buildHotelWhatsappByIdMap(hotelWaRows ?? []);

    const [convResult, msgResult] = await Promise.all([
      supabase
        .from(CONVERSATIONS_TABLE)
        .select("*")
        .eq("hotel_id", activeHotelId)
        .order("updated_at", { ascending: false }),
      supabase
        .from(WUBBY_TABLE)
        .select("*")
        .eq("hotel_id", activeHotelId)
        .order("created_at", { ascending: false })
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
    const msgRows = ((msgResult.data ?? []) as WubbyWhatsappRow[]).reverse();

    const conversations = mergeConversationsTableWithMessages(convRows, msgRows, {
      hotelWhatsappById,
      messageLimit: MESSAGES_LIMIT,
    });
    conversations.sort((a, b) => {
      return getConversationDisplayActivityMs(b) - getConversationDisplayActivityMs(a);
    });

    return NextResponse.json({
      conversations,
      fetchedConversations: convRows.length,
      fetchedMessages: msgRows.length,
      messageLimit: MESSAGES_LIMIT,
      availableHotels,
      activeHotelId,
      hotelWhatsappById: hotelWhatsappMapToRecord(hotelWhatsappById),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[inbox GET]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSessionUser();
    if (auth.response) return auth.response;

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
      action !== "completed" &&
      action !== "resolve_request" &&
      action !== "reopen" &&
      action !== "mark_read"
    ) {
      return NextResponse.json(
        {
          error:
            "action debe ser human_control, reactivate_ai, completed, resolve_request, reopen o mark_read",
        },
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
          unread_count: 0,
          last_read_at: now,
        };
        break;
      case "completed":
        patch = {
          ...patch,
          status: "completed",
          unread_count: 0,
          last_read_at: now,
        };
        break;
      case "resolve_request":
        patch = {
          ...patch,
          request: null,
        };
        break;
      case "reopen":
        // Inversa de `completed`. `completed` solo toca `status`, así que reabrir
        // pone `status = 'open'` y respeta `ai_active` / `needs_human` tal como
        // estaban antes de cerrarse (los reconstruye `mapOperationalFromConversationRow`).
        patch = {
          ...patch,
          status: "open",
        };
        break;
      case "mark_read":
        patch = {
          ...patch,
          unread_count: 0,
          last_read_at: now,
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
