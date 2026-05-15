"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation } from "@/lib/inbox-types";
import { type RealtimeUiStatus, useInboxRealtime } from "@/hooks/useInboxRealtime";

type InboxResponse = {
  conversations: Conversation[];
  fetchedRows?: number;
  error?: string;
};

function sortByLastActivity(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    return new Date(b.lastActivityIso).getTime() - new Date(a.lastActivityIso).getTime();
  });
}

export type RefetchOptions = {
  /** Si es true, no muestra el estado global de carga ni vacía la lista en error (ideal para reconciliación). */
  silent?: boolean;
};

export type UseConversationsOptions = {
  activeConversationId?: string;
};

export function useConversations(options?: UseConversationsOptions) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [urgentHandoffBannerVisible, setUrgentHandoffBannerVisible] = useState(false);
  const [realtimeUiStatus, setRealtimeUiStatus] = useState<RealtimeUiStatus>("waiting");
  const [realtimeErrorDetail, setRealtimeErrorDetail] = useState<string | undefined>(undefined);

  const dismissUrgentHandoffBanner = useCallback(() => {
    setUrgentHandoffBannerVisible(false);
  }, []);

  const onRealtimeConnection = useCallback((status: RealtimeUiStatus, detail?: string) => {
    setRealtimeUiStatus(status);
    setRealtimeErrorDetail(status === "error" ? detail : undefined);
  }, []);

  const load = useCallback(async (options?: RefetchOptions) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch("/api/inbox", { cache: "no-store" });
      const json = (await res.json()) as InboxResponse;
      if (!res.ok) {
        throw new Error(json.error ?? "No se pudo cargar la bandeja");
      }
      const sorted = sortByLastActivity(json.conversations ?? []);
      setConversations(sorted);
      setError(null);
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : "Error de red");
        setConversations([]);
      } else {
        console.warn("[useConversations] Refresco silencioso falló", e);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadRef = useRef(load);
  loadRef.current = load;

  const markConversationRead = useCallback(async (conversationId: string) => {
    const id = conversationId.trim();
    if (!id) return;

    setConversations((prev) =>
      prev.map((c) => (c.id === id && c.unreadCount > 0 ? { ...c, unreadCount: 0 } : c))
    );

    try {
      const res = await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id, action: "mark_read" }),
      });
      if (!res.ok) {
        throw new Error(`mark_read ${res.status}`);
      }
    } catch (e) {
      console.warn("[useConversations] No se pudo marcar como leída", e);
      void loadRef.current({ silent: true });
    }
  }, []);

  // Reconciliación puntual: refetch silencioso cuando la pestaña vuelve al foco,
  // útil si el socket de Realtime estuvo en background o el tab estuvo dormido.
  useEffect(() => {
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        void loadRef.current({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!urgentHandoffBannerVisible) return;
    const t = window.setTimeout(() => {
      setUrgentHandoffBannerVisible(false);
    }, 8000);
    return () => clearTimeout(t);
  }, [urgentHandoffBannerVisible]);

  // Realtime: reemplaza el polling. Si llega un evento sin contexto local
  // (p. ej. nueva conversación o mensaje de un teléfono aún no cargado),
  // disparamos un refetch silencioso para reconciliar.
  useInboxRealtime({
    setConversations,
    activeConversationId: options?.activeConversationId,
    onMissingContext: () => {
      void loadRef.current({ silent: true });
    },
    onUrgentHandoffBanner: () => {
      setUrgentHandoffBannerVisible(true);
    },
    onRealtimeConnection,
  });

  return {
    conversations,
    setConversations,
    loading,
    error,
    refetch: load,
    markConversationRead,
    urgentHandoffBannerVisible,
    dismissUrgentHandoffBanner,
    realtimeUiStatus,
    realtimeErrorDetail,
  };
}
