import type { Message } from "@/lib/inbox-types";
import { appendConversationMessages } from "@/lib/message-limits";

function withConfirmedStatus(incoming: Message): Message {
  return { ...incoming, status: "confirmed" };
}

/**
 * Inserta o reemplaza un mensaje en el hilo de la conversación.
 * 1) Match por clientTempId (optimista → fila en DB).
 * 2) Match por id real.
 * 3) Append.
 */
export function upsertConversationMessage(current: Message[], incoming: Message): Message[] {
  const confirmed = withConfirmedStatus(incoming);

  if (incoming.clientTempId) {
    const optIdx = current.findIndex((m) => m.clientTempId === incoming.clientTempId);
    if (optIdx !== -1) {
      const next = [...current];
      next[optIdx] = confirmed;
      return next;
    }
  }

  const idIdx = current.findIndex((m) => m.id === incoming.id);
  if (idIdx !== -1) {
    const next = [...current];
    next[idIdx] = { ...current[idIdx]!, ...confirmed };
    return next;
  }

  return appendConversationMessages(current, confirmed);
}
