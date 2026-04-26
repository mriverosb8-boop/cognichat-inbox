import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

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

    const payload = {
      guestPhone,
      message,
      conversationId: body.conversationId ?? null,
      source: "FerrarIA-inbox",
      sentAt: new Date().toISOString(),
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
