import type { ConversationDbRow } from "@/lib/conversation-schema";
import type { ControlMode, Conversation, Message, MessageSender, OperationalStatus } from "@/lib/inbox-types";
import type { WubbyWhatsappRow } from "@/lib/wubby-schema";

/** Identidad WhatsApp/Twilio normalizada para comparar (prefijo + dígitos). */
export function normalizeWaIdentity(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string") return "";
  let s = raw.trim();
  const lower = s.toLowerCase();
  if (lower.startsWith("whatsapp:")) {
    s = s.slice("whatsapp:".length).trim();
  }
  s = s.replace(/\s/g, "");
  if (!s.startsWith("+")) {
    const digits = s.replace(/\D/g, "");
    s = digits ? `+${digits}` : "";
  } else {
    s = `+${s.slice(1).replace(/\D/g, "")}`;
  }
  return s;
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
 * Heurística: el número “central” (Twilio / WhatsApp Business) aparece en más mensajes
 * que los huéspedes 1:1. Si `TWILIO_WHATSAPP_ADDRESS` está definido, tiene prioridad.
 */
export function inferTwilioIdentity(rows: WubbyWhatsappRow[], envTwilio?: string | null): string | null {
  const fromEnv = normalizeWaIdentity(envTwilio ?? "");
  if (fromEnv) return fromEnv;

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

/**
 * Obtiene el teléfono del huésped para una fila.
 * Regla: el lado que no es Twilio; si ambos parecen huésped, prioriza sender si no es Twilio.
 */
export function inferGuestPhone(
  row: WubbyWhatsappRow,
  twilio: string | null
): string {
  const s = normalizeWaIdentity(row.sender ?? "");
  const r = normalizeWaIdentity(row.recipient ?? "");
  if (twilio) {
    if (s === twilio && r && r !== twilio) return r;
    if (r === twilio && s && s !== twilio) return s;
    if (s && s !== twilio) return s;
    if (r && r !== twilio) return r;
  }
  return s || r || "unknown";
}

export function getRowField(row: WubbyWhatsappRow, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in row && row[k] !== undefined && row[k] !== null) return row[k];
  }
  return undefined;
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
 * Heurística: mensaje del huésped = user; salida desde Twilio = ai por defecto.
 * Si en el futuro añades una columna (p. ej. `message_author` o `sender_role`), úsala aquí.
 */
export function classifyMessageSender(row: WubbyWhatsappRow, guestNorm: string, twilioNorm: string | null): MessageSender {
  const s = normalizeWaIdentity(row.sender ?? "");
  if (s === guestNorm) return "user";

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

  if (twilioNorm && s === twilioNorm) {
    /* Twilio / WA Business: sin metadata, asumimos IA; los mensajes humanos reales deberían etiquetarse en n8n/BD. */
    return "ai";
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
  const twilio = inferTwilioIdentity(sortedMsgs, options.twilioEnv ?? process.env.TWILIO_WHATSAPP_ADDRESS);

  const messagesByPhone = new Map<string, WubbyWhatsappRow[]>();
  for (const row of sortedMsgs) {
    const g = normalizeWaIdentity(inferGuestPhone(row, twilio));
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

    const messages: Message[] = msgList.map((row) => ({
      id: String(row.id),
      body: String(row.message ?? "").trim() || "(vacío)",
      sentAt: formatMessageDetailTime(row.created_at),
      sender: classifyMessageSender(row, guestPhone, twilio),
    }));

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
 * deriva el `Message` que hay que insertar en la bandeja.
 *
 * Usa el "lado opuesto al huésped" como identidad de Twilio para clasificar IA/Humano,
 * sin necesidad de conocer el valor global de `TWILIO_WHATSAPP_ADDRESS` en cliente.
 */
export function buildMessageFromWubbyRow(
  row: WubbyWhatsappRow,
  guestPhone: string
): {
  message: Message;
  previewRaw: string;
  createdAtIso: string;
  lastMessageLabel: string;
} {
  const guestNorm = normalizeWaIdentity(guestPhone);
  const s = normalizeWaIdentity(row.sender ?? "");
  const r = normalizeWaIdentity(row.recipient ?? "");
  const twilioSide = s === guestNorm ? (r || null) : (s || null);
  const sender = classifyMessageSender(row, guestNorm, twilioSide);

  const body = String(row.message ?? "").trim() || "(vacío)";
  const previewRaw = String(row.message ?? "").trim() || "—";

  return {
    message: {
      id: String(row.id),
      body,
      sentAt: formatMessageDetailTime(row.created_at),
      sender,
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
