import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhoneDigits } from "@/lib/chat-utils";
import { POSTGREST_PAGE_SIZE } from "@/lib/message-limits";
import { WUBBY_TABLE, type WubbyWhatsappRow } from "@/lib/wubby-schema";

/** PostgREST .or() para sender/recipient en dígitos y con prefijo +. */
export function buildGuestPhoneOrFilter(guestDigits: string): string {
  const digits = normalizePhoneDigits(guestDigits);
  if (!digits) return "";
  const plus = `+${digits}`;
  return [
    `sender.eq.${digits}`,
    `sender.eq.${plus}`,
    `recipient.eq.${digits}`,
    `recipient.eq.${plus}`,
  ].join(",");
}

async function fetchWubbyPagesAscending(
  supabase: SupabaseClient,
  hotelId: string,
  orFilter: string | null
): Promise<WubbyWhatsappRow[]> {
  const all: WubbyWhatsappRow[] = [];
  let from = 0;

  while (true) {
    const to = from + POSTGREST_PAGE_SIZE - 1;
    let query = supabase
      .from(WUBBY_TABLE)
      .select("*")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: true })
      .range(from, to);

    if (orFilter) {
      query = query.or(orFilter);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []) as WubbyWhatsappRow[];
    all.push(...batch);
    if (batch.length < POSTGREST_PAGE_SIZE) break;
    from += POSTGREST_PAGE_SIZE;
  }

  return all;
}

async function fetchWubbyPagesDescending(
  supabase: SupabaseClient,
  hotelId: string
): Promise<WubbyWhatsappRow[]> {
  const all: WubbyWhatsappRow[] = [];
  let from = 0;

  while (true) {
    const to = from + POSTGREST_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(WUBBY_TABLE)
      .select("*")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []) as WubbyWhatsappRow[];
    all.push(...batch);
    if (batch.length < POSTGREST_PAGE_SIZE) break;
    from += POSTGREST_PAGE_SIZE;
  }

  return all;
}

/** Todas las filas del hotel (paginado .range); orden ascendente para merge. */
export async function fetchAllWubbyRowsForHotel(
  supabase: SupabaseClient,
  hotelId: string
): Promise<WubbyWhatsappRow[]> {
  const descRows = await fetchWubbyPagesDescending(supabase, hotelId);
  return descRows.reverse();
}

/** Historial completo de un huésped en un hotel; match + y sin + en sender/recipient. */
export async function fetchWubbyRowsForGuestAtHotel(
  supabase: SupabaseClient,
  hotelId: string,
  guestDigits: string
): Promise<WubbyWhatsappRow[]> {
  const orFilter = buildGuestPhoneOrFilter(guestDigits);
  if (!orFilter) return [];
  return fetchWubbyPagesAscending(supabase, hotelId, orFilter);
}
