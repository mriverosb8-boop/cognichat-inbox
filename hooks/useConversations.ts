"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation } from "@/lib/inbox-types";
import { useInboxRealtime } from "@/hooks/useInboxRealtime";

type InboxResponse = {
  conversations: Conversation[];
  fetchedRows?: number;
  error?: string;
};

export type RefetchOptions = {
  /** Si es true, no muestra el estado global de carga ni vacía la lista en error (ideal para reconciliación). */
  silent?: boolean;
};

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setConversations(json.conversations ?? []);
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

  // Realtime: reemplaza el polling. Si llega un evento sin contexto local
  // (p. ej. nueva conversación o mensaje de un teléfono aún no cargado),
  // disparamos un refetch silencioso para reconciliar.
  useInboxRealtime({
    setConversations,
    onMissingContext: () => {
      void loadRef.current({ silent: true });
    },
  });

  return {
    conversations,
    setConversations,
    loading,
    error,
    refetch: load,
  };
}
