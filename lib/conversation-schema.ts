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
  /**
   * Marca operativa cuando la IA detecta que el caso necesita atención humana.
   * - "pending": la IA marcó el caso para seguimiento humano
   * - null / otro valor: caso sin pendiente activo
   */
  request: string | null;
  created_at: string;
  updated_at: string;
};

export type InboxPatchAction =
  | "human_control"
  | "reactivate_ai"
  | "completed"
  | "resolve_request";
