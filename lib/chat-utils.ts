import type { ConversationDbRow } from "@/lib/conversation-schema";
import type { ControlMode, Conversation, Message, MessageSender, OperationalStatus } from "@/lib/inbox-types";
import type { WubbyWhatsappRow } from "@/lib/wubby-schema";

/** Twilio histórico + WhatsApp Cloud API (Meta); dígitos sin prefijo internacional separado. */
export const DEFAULT_HOTEL_PHONE_DIGITS = ["16062685670", "573002422890"] as const;

/**
 * Teléfono solo dígitos para comparar identidades (Twilio `whatsapp:+…`, Meta sin prefijo, etc.).
 */
export function normalizePhoneDigits(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/whatsapp:/gi, "")
    .replace(/\+/g, "")
    .replace(/\s/g, "")
    .replace(/\D/g, "");
}

/** Identidad WhatsApp/Twilio normalizada para comparar (+E.164). */
export function normalizeWaIdentity(raw: string | null | undefined): string {
  const digits = normalizePhoneDigits(raw);
  return digits ? `+${digits}` : "";
}

export type ResolveHotelWaIdentitiesOptions = {
  /** Si viene definido (p. ej. `TWILIO_WHATSAPP_ADDRESS`), se fusiona al conjunto. */
  twilioEnv?: string | null;
  /** CSV opcional adicional (servidor: `HOTEL_WHATSAPP_PHONES`; cliente: `NEXT_PUBLIC_HOTEL_WHATSAPP_PHONES`). */
  extraCsvEnv?: string | null;
};

/**
 * Conjunto de líneas del hotel (+E.164) para routing y clasificación de burbujas.
 * Retrocompatible: incluye Twilio anterior y número Cloud API; ampliable por env.
 */
export function resolveHotelWaIdentitiesSet(opts?: ResolveHotelWaIdentitiesOptions): Set<string> {
  const set = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const id = normalizeWaIdentity(raw);
    if (id) set.add(id);
  };

  for (const digits of DEFAULT_HOTEL_PHONE_DIGITS) {
    add(String(digits));
  }

  add(opts?.twilioEnv ?? process.env.TWILIO_WHATSAPP_ADDRESS);
  add(process.env.WHATSAPP_BUSINESS_PHONE_NUMBER);
  add(process.env.META_WHATSAPP_BUSINESS_PHONE);

  const csv =
    opts?.extraCsvEnv ??
    process.env.HOTEL_WHATSAPP_PHONES ??
    process.env.NEXT_PUBLIC_HOTEL_WHATSAPP_PHONES;
  if (csv) {
    for (const part of csv.split(",")) add(part.trim());
  }

  return set;
}

function inferDominantWaBusinessIdentity(rows: WubbyWhatsappRow[]): string | null {
  const counts = countIdentityOccurrences(rows);
  let best: string | null = null;
  let max = 0;
  for (const [k, v] of counts) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}

function countIdentityOccurrences(rows: WubbyWhatsappRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const side of [row.sender, row.recipient]) {
      const id = normalizeWaIdentity(typeof side === "string" ? side : String(side ?? ""));
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Primera línea de negocio inferida (compatibilidad); preferir `resolveHotelWaIdentitiesSet`.
 * Si hay números conocidos por env/constantes, devuelve uno de ellos; si no, la identidad más frecuente en el histórico.
 */
export function inferTwilioIdentity(rows: WubbyWhatsappRow[], envTwilio?: string | null): string | null {
  const known = resolveHotelWaIdentitiesSet({ twilioEnv: envTwilio });
  const firstKnown = known.values().next().value as string | undefined;
  if (firstKnown) return firstKnown;
  return inferDominantWaBusinessIdentity(rows);
}

/**
 * Obtiene el teléfono del huésped para una fila.
 * Regla: si un lado coincide con una línea del hotel (Twilio o Cloud API), el huésped es el otro lado.
 */
export function inferGuestPhone(row: WubbyWhatsappRow, hotelIdentities: Set<string>): string {
  const s = normalizeWaIdentity(row.sender ?? "");
  const r = normalizeWaIdentity(row.recipient ?? "");
  const sHotel = Boolean(s && hotelIdentities.has(s));
  const rHotel = Boolean(r && hotelIdentities.has(r));

  if (sHotel && r && !hotelIdentities.has(r)) return r;
  if (rHotel && s && !hotelIdentities.has(s)) return s;
  if (s && !hotelIdentities.has(s)) return s;
  if (r && !hotelIdentities.has(r)) return r;
  return s || r || "unknown";
}

export function getRowField(row: WubbyWhatsappRow, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in row && row[k] !== undefined && row[k] !== null) return row[k];
  }
  return undefined;
}

/** Columna `format` en Wubby_Whatsapp (`audio`, `text`, …). */
export function readMessageFormat(row: WubbyWhatsappRow): string | undefined {
  const v = getRowField(row, "format", "Format");
  if (v == null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/** Columna `cause_request` (`yes` = disparó handoff a humano). */
export function readCauseRequest(row: WubbyWhatsappRow): string | undefined {
  const v = getRowField(row, "cause_request", "Cause_Request", "causeRequest");
  if (v == null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/** Columna `cause_of_request` (alerta Realtime: requiere humano). */
export function readCauseOfRequestColumn(row: WubbyWhatsappRow): string | undefined {
  const v = getRowField(row, "cause_of_request", "Cause_Of_Request", "causeOfRequest");
  if (v == null) return undefined;
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Misma regla para badge “Solicitó agente humano”, banner y notificación de escritorio.
 * Acepta fila Supabase o `Message` (campos en camelCase).
 */
export function messageNeedsHumanAlert(messageOrRow: Record<string, unknown>): boolean {
  const raw =
    messageOrRow["cause_of_request"] ??
    messageOrRow["Cause_Of_Request"] ??
    messageOrRow["causeOfRequest"] ??
    messageOrRow["cause_request"] ??
    messageOrRow["Cause_Request"] ??
    messageOrRow["causeRequest"] ??
    messageOrRow["request"] ??
    messageOrRow["requires_human"] ??
    messageOrRow["requiresHuman"] ??
    messageOrRow["needs_human"] ??
    messageOrRow["needsHuman"];

  const normalized = String(raw ?? "").trim().toLowerCase();

  return (
    raw === true ||
    normalized === "yes" ||
    normalized === "true" ||
    normalized === "1" ||
    normalized === "si" ||
    normalized === "sí"
  );
}

/** @deprecated Preferir messageNeedsHumanAlert */
export function messageRowRequiresHumanUrgent(row: WubbyWhatsappRow): boolean {
  return messageNeedsHumanAlert(row as Record<string, unknown>);
}

export function toBool(v: unknown, defaultVal = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return ["true", "1", "yes", "si", "sí", "t"].includes(t);
  }
  return defaultVal;
}

/** Lectura flexible de flag “IA activa” si existe columna en BD. */
export function readAiActive(row: WubbyWhatsappRow, fallback = true): boolean {
  const raw = getRowField(row, "ai_active", "AI Active", "ai_enabled", "AI_Enabled", "ia_activa");
  if (raw === undefined || raw === null) return fallback;
  return toBool(raw, fallback);
}

export function readNeedsHuman(row: WubbyWhatsappRow): boolean {
  return toBool(getRowField(row, "Needs Human", "needs_human", "needsHuman"), false);
}

/**
 * Clasificación de mensaje para la burbuja.
 * - Sender = línea hotel → saliente (IA/agente por defecto).
 * - Recipient = línea hotel y sender no es hotel → entrante huésped.
 * Columnas opcionales (`message_author`, `sender_role`, `from_ai`, …) tienen prioridad cuando existen.
 */
export function classifyMessageSender(
  row: WubbyWhatsappRow,
  guestNorm: string,
  hotelIdentities: Set<string>
): MessageSender {
  const s = normalizeWaIdentity(row.sender ?? "");
  const r = normalizeWaIdentity(row.recipient ?? "");

  if (guestNorm && s === guestNorm) return "user";

  const explicit =
    getRowField(row, "message_author", "sender_role", "Sender Role", "role", "tipo", "author") ??
    getRowField(row, "from_ai", "fromAI");
  if (typeof explicit === "string") {
    const e = explicit.toLowerCase();
    if (/human|agent|staff|person|recepci|operad/i.test(e)) return "agent";
    if (/ai|bot|assistant|automat/i.test(e)) return "ai";
  }
  if (toBool(explicit, false) === false && getRowField(row, "from_ai") != null) {
    return toBool(getRowField(row, "from_ai"), true) ? "ai" : "agent";
  }

  const senderLower = String(row.sender ?? "").toLowerCase();
  if (senderLower.includes("agent") || senderLower.includes("human")) return "agent";

  const directionRaw = getRowField(row, "direction", "Direction");
  if (typeof directionRaw === "string") {
    const d = directionRaw.trim().toLowerCase();
    if (d === "inbound" || d === "incoming") return "user";
    if (d === "outbound" || d === "outgoing") return "ai";
  }

  const senderTypeRaw = getRowField(row, "sender_type", "senderType", "Sender_Type");
  if (typeof senderTypeRaw === "string") {
    const st = senderTypeRaw.trim().toLowerCase();
    if (/guest|visitor|customer|^user$/i.test(st)) return "user";
    if (/human|^agent$|staff|employee/i.test(st)) return "agent";
    if (/ai|assistant|bot|^business$/i.test(st)) return "ai";
  }

  if (s && hotelIdentities.has(s)) {
    return "ai";
  }
  if (r && hotelIdentities.has(r) && (!s || !hotelIdentities.has(s))) {
    return "user";
  }

  return "ai";
}

export function formatMessageListTime(iso: string, locale = "es"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(d);
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return "Ayer";
  }
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(d);
}

export function formatMessageDetailTime(iso: string, locale = "es"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function displayGuestName(guestName: string | null | undefined, guestPhone: string): string {
  const n = typeof guestName === "string" ? guestName.trim() : "";
  if (n.length > 0) return n;
  return guestPhone || "—";
}

function readBoolCol(v: boolean | null | undefined, defaultVal: boolean): boolean {
  if (v === null || v === undefined) return defaultVal;
  return v;
}

/**
 * Estado operativo y modo control a partir de la tabla `conversations`.
 */
export function mapOperationalFromConversationRow(row: ConversationDbRow): {
  operationalStatus: OperationalStatus;
  controlMode: ControlMode;
} {
  const st = String(row.status ?? "").toLowerCase();
  const needsHuman = readBoolCol(row.needs_human, false);
  const aiActive = readBoolCol(row.ai_active, true);
  const blocked = readBoolCol(row.blocked, false);

  if (st === "completed") {
    return { operationalStatus: "closed", controlMode: "human" };
  }
  if (blocked) {
    return { operationalStatus: "requires_attention", controlMode: aiActive ? "ai" : "human" };
  }
  if (st === "human_control") {
    return { operationalStatus: "requires_attention", controlMode: "human" };
  }
  if (needsHuman) {
    return { operationalStatus: "requires_attention", controlMode: "human" };
  }
  if (!aiActive) {
    return { operationalStatus: "requires_attention", controlMode: "human" };
  }
  return { operationalStatus: "ai_active", controlMode: "ai" };
}

function emptyReservation() {
  return {
    confirmationCode: "—",
    checkIn: "—",
    checkOut: "—",
    adults: 0,
    children: 0,
    roomType: "—",
    bookingStatus: "—",
  };
}

/**
 * Bandeja: metadatos desde `conversations`, historial desde `Wubby_Whatsapp`.
 * Orden de `convRows` se respeta (p. ej. `updated_at` desc desde la API).
 */
export function mergeConversationsTableWithMessages(
  convRows: ConversationDbRow[],
  msgRows: WubbyWhatsappRow[],
  options: { twilioEnv?: string | null }
): Conversation[] {
  if (convRows.length === 0) return [];

  const sortedMsgs = [...msgRows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const hotelIdentities = resolveHotelWaIdentitiesSet({
    twilioEnv: options.twilioEnv ?? process.env.TWILIO_WHATSAPP_ADDRESS,
  });

  const messagesByPhone = new Map<string, WubbyWhatsappRow[]>();
  for (const row of sortedMsgs) {
    const g = normalizeWaIdentity(inferGuestPhone(row, hotelIdentities));
    if (!g || g === "unknown") continue;
    const list = messagesByPhone.get(g) ?? [];
    list.push(row);
    messagesByPhone.set(g, list);
  }

  const out: Conversation[] = [];

  for (const cr of convRows) {
    const guestPhone = normalizeWaIdentity(cr.guest_phone ?? "");
    const phoneDisplay = guestPhone || String(cr.guest_phone ?? "").trim() || "—";
    const msgList = guestPhone ? messagesByPhone.get(guestPhone) ?? [] : [];

    const lastRow = msgList.length > 0 ? msgList[msgList.length - 1]! : null;
    const lastPreview = lastRow
      ? String(lastRow.message ?? "").trim() || "—"
      : "Sin mensajes";
    const lastAt = lastRow ? formatMessageListTime(lastRow.created_at) : "—";

    const { operationalStatus, controlMode } = mapOperationalFromConversationRow(cr);
    const needsHuman = readBoolCol(cr.needs_human, false);
    const aiActive = readBoolCol(cr.ai_active, true);

    const cotizacion = cr.cotizacion != null && String(cr.cotizacion).trim() !== "" ? String(cr.cotizacion) : null;

    const title = displayGuestName(cr.guest_name, phoneDisplay);

    const messages: Message[] = msgList.map((msgRow) => {
      const fmt = readMessageFormat(msgRow);
      const causeReqHandoff = readCauseRequest(msgRow);
      const causeOfReq = readCauseOfRequestColumn(msgRow);
      return {
        id: String(msgRow.id),
        body: String(msgRow.message ?? "").trim() || "(vacío)",
        sentAt: formatMessageDetailTime(msgRow.created_at),
        sentAtIso: typeof msgRow.created_at === "string" ? msgRow.created_at : String(msgRow.created_at ?? ""),
        sender: classifyMessageSender(msgRow, guestPhone, hotelIdentities),
        ...(fmt ? { format: fmt } : {}),
        ...(causeReqHandoff ? { causeRequest: causeReqHandoff } : {}),
        ...(causeOfReq ? { causeOfRequest: causeOfReq } : {}),
      };
    });

    const lastActivityIso =
      lastRow &&
      new Date(lastRow.created_at).getTime() > new Date(cr.updated_at).getTime()
        ? lastRow.created_at
        : cr.updated_at;

    const guest = {
      id: cr.id,
      name: title,
      phone: phoneDisplay,
      property: cotizacion ? cotizacion : "Sin propiedad indicada",
      language: "—",
      internalNotes: readBoolCol(cr.blocked, false)
        ? cr.blocked_at
          ? `Bloqueado · ${cr.blocked_at}`
          : "Bloqueado"
        : "Sin notas internas en Supabase.",
      tags: cotizacion ? [cotizacion.slice(0, 24)] : [],
      profileCompleteness: cotizacion ? 35 : 15,
      reservation: emptyReservation(),
    };

    const requestRaw =
      typeof cr.request === "string" ? cr.request.trim() : cr.request;
    const requestValue =
      typeof requestRaw === "string" && requestRaw.length > 0 ? requestRaw : null;

    out.push({
      id: cr.id,
      guest,
      guestPhone: phoneDisplay,
      needsHuman,
      aiActive,
      dbStatus: cr.status,
      blocked: readBoolCol(cr.blocked, false),
      blockedAt: cr.blocked_at,
      request: requestValue,
      lastMessagePreview: lastPreview.length > 120 ? `${lastPreview.slice(0, 117)}…` : lastPreview,
      lastMessageAt: lastAt,
      lastActivityIso,
      unreadCount: 0,
      operationalStatus,
      controlMode,
      channelLabel: "WhatsApp",
      messages,
    });
  }

  return out;
}

/** Expone semilla estable para avatares. */
export function guestSeed(guestPhone: string): string {
  return guestPhone;
}

/**
 * Dado un row de `Wubby_Whatsapp` y el teléfono del huésped (conversación destino),
 * deriva el `Message` para Realtime / UI incremental.
 *
 * `hotelIdentities` debe coincidir con merge del servidor (`mergeConversationsTableWithMessages`);
 * en cliente usar `resolveHotelWaIdentitiesSet()` (incluye `NEXT_PUBLIC_HOTEL_WHATSAPP_PHONES` si la defines).
 */
export function buildMessageFromWubbyRow(
  row: WubbyWhatsappRow,
  guestPhone: string,
  hotelIdentities: Set<string>
): {
  message: Message;
  previewRaw: string;
  createdAtIso: string;
  lastMessageLabel: string;
} {
  const guestNorm = normalizeWaIdentity(guestPhone);
  const sender = classifyMessageSender(row, guestNorm, hotelIdentities);

  const body = String(row.message ?? "").trim() || "(vacío)";
  const previewRaw = String(row.message ?? "").trim() || "—";
  const fmt = readMessageFormat(row);
  const causeReqHandoff = readCauseRequest(row);
  const causeOfReq = readCauseOfRequestColumn(row);

  return {
    message: {
      id: String(row.id),
      body,
      sentAt: formatMessageDetailTime(row.created_at),
      sentAtIso: typeof row.created_at === "string" ? row.created_at : String(row.created_at ?? ""),
      sender,
      ...(fmt ? { format: fmt } : {}),
      ...(causeReqHandoff ? { causeRequest: causeReqHandoff } : {}),
      ...(causeOfReq ? { causeOfRequest: causeOfReq } : {}),
    },
    previewRaw,
    createdAtIso: row.created_at,
    lastMessageLabel: formatMessageListTime(row.created_at),
  };
}

/** Devuelve la conversación cuyo `guestPhone` matchea el `sender` o `recipient` del row. */
export function findConversationForWubbyRow(
  conversations: Conversation[],
  row: WubbyWhatsappRow
): Conversation | null {
  const s = normalizeWaIdentity(row.sender ?? "");
  const r = normalizeWaIdentity(row.recipient ?? "");
  if (!s && !r) return null;
  for (const c of conversations) {
    const cp = normalizeWaIdentity(c.guestPhone);
    if (!cp) continue;
    if (cp === s || cp === r) return c;
  }
  return null;
}

/**
 * Aplica un patch incremental sobre una conversación existente a partir de un row
 * actualizado de `conversations`. Preserva mensajes ya cargados.
 */
export function applyConversationRowPatch(
  existing: Conversation,
  row: ConversationDbRow
): Conversation {
  const { operationalStatus, controlMode } = mapOperationalFromConversationRow(row);
  const requestRaw = typeof row.request === "string" ? row.request.trim() : row.request;
  const requestValue =
    typeof requestRaw === "string" && requestRaw.length > 0 ? requestRaw : null;

  const normalizedPhone = normalizeWaIdentity(row.guest_phone ?? "");
  const phoneDisplay =
    normalizedPhone || String(row.guest_phone ?? "").trim() || existing.guestPhone;
  const name = displayGuestName(row.guest_name, phoneDisplay);

  const cotizacion =
    row.cotizacion != null && String(row.cotizacion).trim() !== ""
      ? String(row.cotizacion)
      : null;

  const updatedIso = row.updated_at || existing.lastActivityIso;
  const lastActivityIso =
    new Date(updatedIso).getTime() > new Date(existing.lastActivityIso).getTime()
      ? updatedIso
      : existing.lastActivityIso;

  return {
    ...existing,
    guest: {
      ...existing.guest,
      id: row.id,
      name,
      phone: phoneDisplay,
      property: cotizacion ? cotizacion : existing.guest.property,
      tags: cotizacion ? [cotizacion.slice(0, 24)] : existing.guest.tags,
    },
    guestPhone: phoneDisplay,
    needsHuman: row.needs_human ?? false,
    aiActive: row.ai_active ?? true,
    dbStatus: row.status,
    blocked: row.blocked ?? false,
    blockedAt: row.blocked_at,
    request: requestValue,
    operationalStatus,
    controlMode,
    lastActivityIso,
  };
}
