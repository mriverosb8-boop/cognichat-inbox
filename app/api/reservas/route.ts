import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import {
  IBIS_BARRANQUILLA_HOTEL_ID,
  type Reserva,
} from "@/app/reservas/lib/types";

export const dynamic = "force-dynamic";

const RESERVAS_TABLE = "reservas";
const RESERVA_SELECT = `
  id,
  hotel_id,
  quote_request_id,
  conversation_id,
  titular_nombre,
  cedula,
  correo,
  notas,
  status,
  rejection_reason,
  created_at,
  completed_at,
  processed_by,
  quote_requests (
    id,
    sender_phone,
    guest_name,
    guest_email,
    fecha_entrada,
    fecha_salida,
    nights,
    num_rooms,
    room_type_requested,
    adults,
    children,
    pets,
    breakfast_included,
    total_amount,
    breakdown_json,
    conversation_id
  )
`;

function baseReservasQuery() {
  return getSupabaseServerClient()
    .from(RESERVAS_TABLE)
    .select(RESERVA_SELECT)
    .eq("hotel_id", IBIS_BARRANQUILLA_HOTEL_ID);
}

export async function GET(request: Request) {
  try {
    const auth = await requireSessionUser();
    if (auth.response) return auth.response;

    const url = new URL(request.url);
    const countOnly = url.searchParams.get("count") === "1";
    const tab = url.searchParams.get("tab") === "procesadas" ? "procesadas" : "pendientes";
    const supabase = getSupabaseServerClient();

    if (countOnly) {
      const { count, error } = await supabase
        .from(RESERVAS_TABLE)
        .select("id", { count: "exact", head: true })
        .eq("hotel_id", IBIS_BARRANQUILLA_HOTEL_ID)
        .eq("status", "pendiente");

      if (error) {
        console.error("[reservas count GET]", error);
        return NextResponse.json({ error: error.message }, { status: 502 });
      }
      return NextResponse.json({ count: count ?? 0 });
    }

    const query =
      tab === "procesadas"
        ? baseReservasQuery()
            .in("status", ["completada", "rechazada"])
            .order("completed_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(100)
        : baseReservasQuery()
            .eq("status", "pendiente")
            .order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error("[reservas GET]", error);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json({ reservas: (data ?? []) as unknown as Reserva[] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    console.error("[reservas GET]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSessionUser();
    if (auth.response) return auth.response;

    const body = (await request.json()) as {
      id?: string;
      action?: "complete" | "reject" | "reopen";
      rejectionReason?: string;
    };

    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "id es obligatorio" }, { status: 400 });
    }

    const now = new Date().toISOString();
    let patch: Record<string, unknown>;

    if (body.action === "complete") {
      patch = {
        status: "completada",
        completed_at: now,
      };
    } else if (body.action === "reject") {
      const reason = body.rejectionReason?.trim();
      if (!reason) {
        return NextResponse.json({ error: "rejectionReason es obligatorio" }, { status: 400 });
      }
      patch = {
        status: "rechazada",
        rejection_reason: reason,
        completed_at: now,
      };
    } else if (body.action === "reopen") {
      patch = {
        status: "pendiente",
        completed_at: null,
        rejection_reason: null,
      };
    } else {
      return NextResponse.json({ error: "action debe ser complete, reject o reopen" }, { status: 400 });
    }

    const { data, error } = await getSupabaseServerClient()
      .from(RESERVAS_TABLE)
      .update(patch)
      .eq("id", id)
      .eq("hotel_id", IBIS_BARRANQUILLA_HOTEL_ID)
      .select(RESERVA_SELECT)
      .single();

    if (error) {
      console.error("[reservas PATCH]", error);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json({ ok: true, reserva: data as unknown as Reserva });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    console.error("[reservas PATCH]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
