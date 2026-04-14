/** Estado de la conversación en la operación (cola de recepción + IA). */
export type OperationalStatus = "ai_active" | "requires_attention" | "closed";

export type ControlMode = "ai" | "human";

export type MessageSender = "user" | "ai" | "agent";

export interface AiMessageMeta {
  latencyMs: number;
  tokens: number;
}

/** Reserva PMS: solo se muestra si hay datos reales o derivados. */
export interface ReservationDetails {
  confirmationCode: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomType: string;
  bookingStatus: string;
}

export interface Guest {
  id: string;
  name: string;
  phone: string;
  property: string;
  language: string;
  internalNotes: string;
  tags: string[];
  /** 0–100; sin datos de Supabase será bajo o 0 */
  profileCompleteness: number;
  reservation: ReservationDetails;
}

export interface Message {
  id: string;
  body: string;
  /** ISO o etiqueta corta según build */
  sentAt: string;
  sender: MessageSender;
  aiMeta?: AiMessageMeta;
}

export interface Conversation {
  /** UUID de la fila en `conversations` */
  id: string;
  guest: Guest;
  lastMessagePreview: string;
  lastMessageAt: string;
  /** ISO 8601 del último mensaje (panel derecho) */
  lastActivityIso: string;
  unreadCount: number;
  operationalStatus: OperationalStatus;
  controlMode: ControlMode;
  channelLabel: string;
  messages: Message[];
  /** Teléfono huésped normalizado (+E.164) para envío / matching */
  guestPhone: string;
  /** Copia de `conversations.needs_human` */
  needsHuman: boolean;
  /** Copia de `conversations.ai_active` */
  aiActive: boolean;
  /** Copia de `conversations.status` */
  dbStatus: string | null;
  blocked: boolean;
  blockedAt: string | null;
}
