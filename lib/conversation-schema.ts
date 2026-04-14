/** Fila de la tabla `conversations` (estado de bandeja). */
export const CONVERSATIONS_TABLE = "conversations";

export type ConversationDbRow = {
  id: string;
  guest_phone: string | null;
  guest_name: string | null;
  status: string | null;
  needs_human: boolean | null;
  ai_active: boolean | null;
  cotizacion: string | null;
  blocked: boolean | null;
  blocked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InboxPatchAction = "human_control" | "reactivate_ai" | "completed";
