"use client";

import { useCallback, useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { IBIS_BARRANQUILLA_HOTEL_ID } from "../lib/types";

export function useReservasCount() {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/reservas?count=1", { cache: "no-store" });
      const payload = (await response.json()) as { count?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar el contador");
      setCount(payload.count ?? 0);
    } catch (e) {
      console.warn("[useReservasCount] No se pudo actualizar el contador", e);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient> | null = null;
    let channel: RealtimeChannel | null = null;

    try {
      supabase = createClient();
    } catch (e) {
      console.warn("[reservas count realtime] cliente no inicializado", e);
      return;
    }

    channel = supabase
      .channel("reservas-count")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reservas",
          filter: `hotel_id=eq.${IBIS_BARRANQUILLA_HOTEL_ID}`,
        },
        () => void load()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reservas",
          filter: `hotel_id=eq.${IBIS_BARRANQUILLA_HOTEL_ID}`,
        },
        () => void load()
      )
      .subscribe();

    return () => {
      if (channel && supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [load]);

  return count;
}
