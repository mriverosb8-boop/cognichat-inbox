import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function readHotelWhatsappConfig(hotelId: string | null | undefined): Promise<{
  whatsappPhoneNumberId: string | null;
  whatsappNumber: string | null;
}> {
  const empty = { whatsappPhoneNumberId: null, whatsappNumber: null };
  const trimmedHotelId = typeof hotelId === "string" ? hotelId.trim() : "";
  if (!trimmedHotelId) return empty;

  try {
    const supabase = getSupabaseServerClient();
    const { data: hotel, error } = await supabase
      .from("hotels")
      .select("whatsapp_phone_number_id, whatsapp_number")
      .eq("id", trimmedHotelId)
      .maybeSingle();

    if (error) {
      console.error("[send-human-message] hotel lookup failed", error);
      return empty;
    }

    return {
      whatsappPhoneNumberId: hotel?.whatsapp_phone_number_id ?? null,
      whatsappNumber: hotel?.whatsapp_number ?? null,
    };
  } catch (e) {
    console.error("[send-human-message] hotel lookup exception", e);
    return empty;
  }
}

/**
 * Envía el mensaje humano a n8n (no Twilio desde el frontend).
 * Configura `N8N_SEND_MESSAGE_WEBHOOK_URL` con la URL del webhook de n8n.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSessionUser();
    if (auth.response) return auth.response;

    const body = (await request.json()) as {
      guestPhone?: string;
      message?: string;
      conversationId?: string;
      hotelId?: string | null;
      clientTempId?: string;
    };

    const guestPhone = body.guestPhone?.trim();
    const message = body.message?.trim();
    if (!guestPhone || !message) {
      return NextResponse.json({ error: "guestPhone y message son obligatorios" }, { status: 400 });
    }

    const webhook = process.env.N8N_SEND_MESSAGE_WEBHOOK_URL;
    if (!webhook) {
      return NextResponse.json(
        {
          ok: false,
          skipped: true,
          error:
            "N8N_SEND_MESSAGE_WEBHOOK_URL no está definida. Añádela en .env.local para enviar a n8n.",
        },
        { status: 503 }
      );
    }

    const hotelWhatsapp = await readHotelWhatsappConfig(body.hotelId);

    const clientTempId = body.clientTempId?.trim() || null;

    const payload = {
      guestPhone,
      message,
      conversationId: body.conversationId ?? null,
      hotelId: body.hotelId ?? null,
      whatsappPhoneNumberId: hotelWhatsapp.whatsappPhoneNumberId,
      whatsappNumber: hotelWhatsapp.whatsappNumber,
      source: "FerrarIA-inbox",
      sentAt: new Date().toISOString(),
      clientTempId,
    };

    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[send-human-message]", res.status, text);
      return NextResponse.json(
        { error: `Webhook respondió ${res.status}`, detail: text.slice(0, 500) },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
