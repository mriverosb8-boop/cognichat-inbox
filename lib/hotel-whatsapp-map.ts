import type { WubbyWhatsappRow } from "@/lib/wubby-schema";

export type HotelWhatsappByIdMap = Map<string, string>;

function normalizeWaIdentity(raw: string | null | undefined): string {
  const digits = String(raw ?? "")
    .trim()
    .replace(/whatsapp:/gi, "")
    .replace(/\+/g, "")
    .replace(/\s/g, "")
    .replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

export function buildHotelWhatsappByIdMap(
  rows: Array<{ id: string; whatsapp_number?: string | null }>
): HotelWhatsappByIdMap {
  const map = new Map<string, string>();
  for (const row of rows) {
    const id = String(row.id ?? "").trim();
    const wa = normalizeWaIdentity(row.whatsapp_number);
    if (id && wa) map.set(id, wa);
  }
  return map;
}

export function hotelWhatsappMapToRecord(map: HotelWhatsappByIdMap): Record<string, string> {
  return Object.fromEntries(map);
}

export function hotelWhatsappMapFromRecord(record: Record<string, string>): HotelWhatsappByIdMap {
  return buildHotelWhatsappByIdMap(
    Object.entries(record).map(([id, whatsapp_number]) => ({ id, whatsapp_number }))
  );
}

export function readRowHotelId(row: WubbyWhatsappRow): string | null {
  const rowRec = row as Record<string, unknown>;
  const raw = row.hotel_id ?? rowRec.hotelId;
  const id = String(raw ?? "").trim();
  return id || null;
}

/** Set de una sola identidad: el whatsapp_number del hotel de esta fila. */
export function resolveHotelWaIdentitiesForRow(
  row: WubbyWhatsappRow,
  map: HotelWhatsappByIdMap
): Set<string> {
  const hotelId = readRowHotelId(row);
  const wa = hotelId ? map.get(hotelId) : undefined;
  return wa ? new Set([wa]) : new Set();
}
