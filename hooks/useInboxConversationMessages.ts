"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Conversation, Message } from "@/lib/inbox-types";

type MessagesResponse = {
  messages?: Message[];
  error?: string;
};

export function useInboxConversationMessages(
  conversationId: string,
  hotelId: string | null,
  setConversations: Dispatch<SetStateAction<Conversation[]>>
) {
  const [loadingMessages, setLoadingMessages] = useState(false);
  const fetchKeyRef = useRef("");

  useEffect(() => {
    const convId = conversationId.trim();
    const hid = hotelId?.trim() ?? "";
    if (!convId || !hid) {
      setLoadingMessages(false);
      return;
    }

    const key = `${hid}:${convId}`;
    fetchKeyRef.current = key;
    let cancelled = false;

    void (async () => {
      setLoadingMessages(true);
      try {
        const params = new URLSearchParams({ conversationId: convId, hotelId: hid });
        const res = await fetch(`/api/inbox/messages?${params}`, { cache: "no-store" });
        const json = (await res.json()) as MessagesResponse;
        if (!res.ok) {
          throw new Error(json.error ?? "No se pudo cargar el historial");
        }
        if (cancelled || fetchKeyRef.current !== key) return;

        const messages = json.messages ?? [];
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, messages } : c))
        );
      } catch (e) {
        if (!cancelled) {
          console.warn("[useInboxConversationMessages]", e);
        }
      } finally {
        if (!cancelled && fetchKeyRef.current === key) {
          setLoadingMessages(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, hotelId, setConversations]);

  return { loadingMessages };
}
