/**
 * Fila de la tabla `Wubby_Whatsapp`.
 * Columnas con espacios o guiones se leen por clave entre comillas en el objeto.
 */
export type WubbyWhatsappRow = {
  id: string | number;
  created_at: string;
  hotel_id?: string | null;
  message: string | null;
  recipient: string | null;
  sender: string | null;
  cotizacion?: string | null;
  /** p. ej. `audio` (voz transcrito) o `text` */
  format?: string | null;
  message_type?: string | null;
  media_url?: string | null;
  media_storage_path?: string | null;
  media_mime_type?: string | null;
  media_caption?: string | null;
  media_filename?: string | null;
  media_meta_id?: string | null;
  media_bucket?: string | null;
  meta_media_id?: string | null;
  storage_path?: string | null;
  image_url?: string | null;
  file_url?: string | null;
  /** `yes` si el mensaje provocó handoff a humano */
  cause_request?: string | null;
  /** `yes` si el caso requiere atención humana (alertas Realtime) */
  cause_of_request?: string | null;
} & Record<string, unknown>;

export const WUBBY_TABLE = "Wubby_Whatsapp";
