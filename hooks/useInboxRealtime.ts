"use client";

import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  CONVERSATIONS_TABLE,
  type ConversationDbRow,
} from "@/lib/conversation-schema";
import { WUBBY_TABLE, type WubbyWhatsappRow } from "@/lib/wubby-schema";
import type { Conversation } from "@/lib/inbox-types";
import {
  applyConversationRowPatch,
  buildMessageFromWubbyRow,
  findConversationForWubbyRow,
} from "@/lib/chat-utils";

type SetConversations = Dispatch<SetStateAction<Conversation[]>>;

type ConversationsPayload = RealtimePostgresChangesPayload<ConversationDbRow>;
type WubbyPayload = RealtimePostgresChangesPayload<WubbyWhatsappRow>;

export type UseInboxRealtimeOptions = {
  setConversations: SetConversations;
  /**
   * Se llama cuando llega un evento para el que no tenemos contexto local
   * (p. ej. INSERT en `conversations`, o mensaje de un teléfono desconocido).
   * Típicamente dispara un refetch silencioso para reconciliar.
   */
  onMissingContext?: () => void;
};

/** Reordena la lista por `lastActivityIso` descendente. */
function sortByActivity(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    const ta = new Date(a.lastActivityIso).getTime();
    const tb = new Date(b.lastActivityIso).getTime();
    return tb - ta;
  });
}

function truncatePreview(preview: string): string {
  return preview.length > 120 ? `${preview.slice(0, 117)}…` : preview;
}

/**
 * Supabase Realtime para la bandeja.
 * Reemplaza al polling: se suscribe a `public.conversations` y `public.Wubby_Whatsapp`
 * y aplica parches incrementales al estado de conversaciones.
 */
export function useInboxRealtime({
  setConversations,
  onMissingContext,
}: UseInboxRealtimeOptions) {
  const setConversationsRef = useRef(setConversations);
  setConversationsRef.current = setConversations;

  const onMissingRef = useRef(onMissingContext);
  onMissingRef.current = onMissingContext;

  useEffect(() => {
    let supabase: ReturnType<typeof createClient> | null = null;
    let channel: RealtimeChannel | null = null;

    try {
      supabase = createClient();
    } catch (e) {
      console.warn("[inbox realtime] cliente no inicializado", e);
      return;
    }

    const requestMissing = () => onMissingRef.current?.();

    const handleConversationEvent = (payload: ConversationsPayload) => {
      const eventType = payload.eventType;
      const setter = setConversationsRef.current;

      if (eventType === "DELETE") {
        const oldRow = payload.old as Partial<ConversationDbRow> | null;
        const oldId = oldRow?.id;
        if (!oldId) return;
        setter((prev) => prev.filter((c) => c.id !== oldId));
        return;
      }

      const newRow = payload.new as ConversationDbRow | null;
      if (!newRow || !newRow.id) return;

      if (eventType === "INSERT") {
        setter((prev) => {
          if (prev.some((c) => c.id === newRow.id)) return prev;
          requestMissing();
          return prev;
        });
        return;
      }

      // UPDATE
      setter((prev) => {
        const idx = prev.findIndex((c) => c.id === newRow.id);
        if (idx === -1) {
          requestMissing();
          return prev;
        }
        const next = [...prev];
        next[idx] = applyConversationRowPatch(next[idx]!, newRow);
        return next;
      });
    };

    const handleMessageEvent = (payload: WubbyPayload) => {
      const eventType = payload.eventType;
      const setter = setConversationsRef.current;

      if (eventType === "INSERT") {
        const row = payload.new as WubbyWhatsappRow | null;
        if (!row) return;
        const messageId = String(row.id);

        setter((prev) => {
          const target = findConversationForWubbyRow(prev, row);
          if (!target) {
            requestMissing();
            return prev;
          }
          if (target.messages.some((m) => m.id === messageId)) return prev;

          const built = buildMessageFromWubbyRow(row, target.guestPhone);
          const updated = prev.map((c) => {
            if (c.id !== target.id) return c;
            const shouldBumpPreview =
              new Date(built.createdAtIso).getTime() >=
              new Date(c.lastActivityIso).getTime();
            return {
              ...c,
              messages: [...c.messages, built.message],
              lastMessagePreview: shouldBumpPreview
                ? truncatePreview(built.previewRaw)
                : c.lastMessagePreview,
              lastMessageAt: shouldBumpPreview ? built.lastMessageLabel : c.lastMessageAt,
              lastActivityIso: shouldBumpPreview ? built.createdAtIso : c.lastActivityIso,
            };
          });
          return sortByActivity(updated);
        });
        return;
      }

      if (eventType === "UPDATE") {
        const row = payload.new as WubbyWhatsappRow | null;
        if (!row) return;
        const messageId = String(row.id);
        setter((prev) => {
          let touched = false;
          const next = prev.map((c) => {
            const mi = c.messages.findIndex((m) => m.id === messageId);
            if (mi === -1) return c;
            const built = buildMessageFromWubbyRow(row, c.guestPhone);
            const newMsgs = [...c.messages];
            newMsgs[mi] = built.message;
            touched = true;
            const isLast = mi === c.messages.length - 1;
            return {
              ...c,
              messages: newMsgs,
              lastMessagePreview: isLast
                ? truncatePreview(built.previewRaw)
                : c.lastMessagePreview,
              lastMessageAt: isLast ? built.lastMessageLabel : c.lastMessageAt,
              lastActivityIso: isLast ? built.createdAtIso : c.lastActivityIso,
            };
          });
          return touched ? next : prev;
        });
        return;
      }

      if (eventType === "DELETE") {
        const oldRow = payload.old as Partial<WubbyWhatsappRow> | null;
        if (!oldRow || oldRow.id == null) return;
        const messageId = String(oldRow.id);
        setter((prev) =>
          prev.map((c) => {
            if (!c.messages.some((m) => m.id === messageId)) return c;
            return {
              ...c,
              messages: c.messages.filter((m) => m.id !== messageId),
            };
          })
        );
      }
    };

    channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CONVERSATIONS_TABLE },
        handleConversationEvent as (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: WUBBY_TABLE },
        handleMessageEvent as (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn("[inbox realtime] error de suscripción", status, err);
        }
      });

    return () => {
      if (channel && supabase) {
        try {
          void supabase.removeChannel(channel);
        } catch (e) {
          console.warn("[inbox realtime] error al limpiar canal", e);
        }
      }
    };
  }, []);
}
