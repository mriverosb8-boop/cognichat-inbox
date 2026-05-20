import type { Reserva } from "./types";

const COP_FORMATTER = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const ROOM_ABBREVIATIONS: Record<string, string> = {
  DBC: "Estandar",
  TWC: "2 camas",
  DSC: "Sofacama",
  "Estandar cama doble": "Estandar",
  "Estandar con cama doble": "Estandar",
  "2 camas sencillas": "2 camas",
  "Cama doble con sofacama": "Sofacama",
  "Familiar (con sofá cama)": "Familiar",
};

const ROOM_TYPE_LABELS: Record<string, string> = {
  DBC: "Estandar con cama doble",
  TWC: "2 camas sencillas",
  DSC: "Cama doble con sofacama",
};

export function formatCOT(id: string): string {
  return `COT-${id.slice(0, 4).toUpperCase()}`;
}

export function formatRoomType(value: string | null | undefined): string {
  const roomType = String(value ?? "").trim();
  if (!roomType) return "No especificado";
  return ROOM_TYPE_LABELS[roomType] ?? roomType;
}

export function abreviarHabitacion(roomType: string | null | undefined): string {
  const value = String(roomType ?? "").trim();
  if (!value) return "No especificado";
  return ROOM_ABBREVIATIONS[value] ?? value;
}

export function formatTotal(value: number | string | null | undefined): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return COP_FORMATTER.format(Number.isFinite(amount) ? Math.round(amount) : 0);
}

export function formatFecha(value: string | null | undefined, pair?: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  const pairDate = pair ? new Date(`${pair}T00:00:00`) : null;
  const includeYear = Boolean(pairDate && !Number.isNaN(pairDate.getTime()) && pairDate.getFullYear() !== date.getFullYear());
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  })
    .format(date)
    .replace(".", "");
}

export function formatTiempoRelativo(value: string | null | undefined): string {
  if (!value) return "—";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "—";
  const diffMs = Date.now() - time;
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  if (hours < 48) return "ayer";
  const days = Math.floor(hours / 24);
  return `hace ${days} días`;
}

export function formatHuespedes(adults: number | null | undefined, children: number | null | undefined): string {
  const adultCount = adults ?? 0;
  const childCount = children ?? 0;
  const adultLabel = `${adultCount} ${adultCount === 1 ? "adulto" : "adultos"}`;
  if (childCount <= 0) return adultLabel;
  return `${adultLabel}, ${childCount} ${childCount === 1 ? "niño" : "niños"}`;
}

export function formatSiNo(value: boolean | null | undefined): string {
  return value ? "Sí" : "No";
}

export function getDescuentoLabel(breakdown: Record<string, unknown> | null): string | null {
  const raw = breakdown?.descuento_pct;
  const pct = typeof raw === "number" ? raw : Number(raw ?? 0);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return `${pct}% anticipación`;
}

export function getSubtotalSinIva(breakdown: Record<string, unknown> | null): number | null {
  const keys = ["subtotal", "subtotal_sin_iva", "subtotal_without_tax", "total_sin_iva", "base"];
  for (const key of keys) {
    const raw = breakdown?.[key];
    const value = typeof raw === "number" ? raw : Number(raw ?? NaN);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function buildOperaClipboardText(reserva: Reserva): string {
  const quote = reserva.quote_requests;
  const subtotalSinIva = getSubtotalSinIva(quote?.breakdown_json ?? null);
  return [
    `Reserva ${formatCOT(reserva.quote_request_id)}`,
    `Titular: ${reserva.titular_nombre ?? "—"}`,
    `Documento: ${reserva.cedula ?? "—"}`,
    `Correo: ${reserva.correo ?? "—"}`,
    `Notas: ${reserva.notas?.trim() || "Sin notas"}`,
    "",
    `Teléfono WhatsApp: ${quote?.sender_phone ?? "—"}`,
    `Entrada: ${quote?.fecha_entrada ?? "—"}`,
    `Salida: ${quote?.fecha_salida ?? "—"}`,
    `Noches: ${quote?.nights ?? 0}`,
    `Habitación: ${quote?.num_rooms ?? 0} x ${formatRoomType(quote?.room_type_requested)}`,
    `Adultos: ${quote?.adults ?? 0}`,
    `Niños: ${quote?.children ?? 0}`,
    `Mascotas: ${formatSiNo(quote?.pets)}`,
    `Desayuno: ${formatSiNo(quote?.breakfast_included)}`,
    ...(subtotalSinIva == null ? [] : [`Total sin IVA: ${formatTotal(subtotalSinIva)}`]),
    `Total: ${formatTotal(quote?.total_amount)} COP`,
  ].join("\n");
}
