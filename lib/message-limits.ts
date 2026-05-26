export const MESSAGES_LIMIT = 325;
/** Tamaño máximo por página en PostgREST/Supabase (el .limit() superior no lo supera). */
export const POSTGREST_PAGE_SIZE = 1000;
/** @deprecated Usar fetchAllWubbyRowsForHotel con paginación .range(). */
export const MESSAGE_FETCH_LIMIT = 8000;

/** Tras cargar historial completo (>325), no recortar al añadir mensajes. */
export function appendConversationMessages<T>(current: T[], added: T): T[] {
  const next = [...current, added];
  return next.length > MESSAGES_LIMIT ? next : next.slice(-MESSAGES_LIMIT);
}
