/**
 * Fila de la tabla `Wubby_Whatsapp`.
 * Columnas con espacios o guiones se leen por clave entre comillas en el objeto.
 */
export type WubbyWhatsappRow = {
  id: string | number;
  created_at: string;
  message: string | null;
  recipient: string | null;
  sender: string | null;
  cotizacion?: string | null;
  /** p. ej. `audio` (voz transcrito) o `text` */
  format?: string | null;
  /** `yes` si el mensaje provocó handoff a humano */
  cause_request?: string | null;
} & Record<string, unknown>;

export const WUBBY_TABLE = "Wubby_Whatsapp";
