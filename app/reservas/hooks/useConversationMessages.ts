"use client";

import { useEffect, useState } from "react";
import type { Conversation, Message } from "@/lib/inbox-types";

type MessagesResponse = {
  conversation: Conversation | null;
  messages: Message[];
  error?: string;
};

export function useConversationMessages({
  conversationId,
  guestPhone,
}: {
  conversationId?: string | null;
  guestPhone?: string | null;
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId && !guestPhone) {
      setConversation(null);
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const params = new URLSearchParams();
        if (conversationId) params.set("conversationId", conversationId);
        if (guestPhone) params.set("guestPhone", guestPhone);
        const response = await fetch(
          `/api/reservas/messages?${params.toString()}`,
          { cache: "no-store", signal: controller.signal }
        );
        const payload = (await response.json()) as MessagesResponse;
        if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar el chat");
        setConversation(payload.conversation ?? null);
        setMessages(payload.messages ?? []);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setConversation(null);
        setMessages([]);
        setError(e instanceof Error ? e.message : "Error de red");
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [conversationId, guestPhone]);

  return { conversation, messages, loading, error };
}
