"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  IBIS_BARRANQUILLA_HOTEL_ID,
  type Reserva,
  type ReservaActionResponse,
  type ReservasListResponse,
} from "../lib/types";

type ReservaRealtimeRow = {
  id: string;
  hotel_id?: string | null;
  status?: string | null;
  titular_nombre?: string | null;
};

function sortPendientes(list: Reserva[]): Reserva[] {
  return [...list].sort((a, b) => {
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });
}

function sortProcesadas(list: Reserva[]): Reserva[] {
  return [...list].sort((a, b) => {
    const bTime = b.completed_at ?? b.created_at;
    const aTime = a.completed_at ?? a.created_at;
    return new Date(bTime ?? 0).getTime() - new Date(aTime ?? 0).getTime();
  });
}

function upsertReserva(list: Reserva[], reserva: Reserva, tab: "pendientes" | "procesadas"): Reserva[] {
  const next = list.filter((item) => item.id !== reserva.id);
  const withReserva = [reserva, ...next];
  return tab === "pendientes" ? sortPendientes(withReserva) : sortProcesadas(withReserva);
}

async function fetchReservas(tab: "pendientes" | "procesadas") {
  const response = await fetch(`/api/reservas?tab=${tab}`, { cache: "no-store" });
  const payload = (await response.json()) as ReservasListResponse;
  if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las reservas");
  return payload.reservas ?? [];
}

export function useReservas(options?: { onNewReserva?: (reserva: Pick<Reserva, "titular_nombre">) => void }) {
  const [pendientes, setPendientes] = useState<Reserva[]>([]);
  const [procesadas, setProcesadas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onNewReservaRef = useRef(options?.onNewReserva);

  useEffect(() => {
    onNewReservaRef.current = options?.onNewReserva;
  }, [options?.onNewReserva]);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [pendingRows, processedRows] = await Promise.all([
        fetchReservas("pendientes"),
        fetchReservas("procesadas"),
      ]);
      setPendientes(pendingRows);
      setProcesadas(processedRows);
      setError(null);
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : "Error de red");
      } else {
        console.warn("[useReservas] Refresco silencioso falló", e);
      }
    } finally {
      if (!silent) setLoading(false);
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
      console.warn("[reservas realtime] cliente no inicializado", e);
      return;
    }

    const applyRealtimeRow = async (
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>
    ) => {
      const row = payload.new as ReservaRealtimeRow | null;
      if (!row || row.hotel_id !== IBIS_BARRANQUILLA_HOTEL_ID) return;

      await load(true);
      if (payload.eventType === "INSERT" && row.status === "pendiente") {
        onNewReservaRef.current?.({ titular_nombre: row.titular_nombre ?? "Huésped" });
      }
    };

    channel = supabase
      .channel("reservas-table")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reservas",
          filter: `hotel_id=eq.${IBIS_BARRANQUILLA_HOTEL_ID}`,
        },
        (payload) => void applyRealtimeRow(payload)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reservas",
          filter: `hotel_id=eq.${IBIS_BARRANQUILLA_HOTEL_ID}`,
        },
        (payload) => void applyRealtimeRow(payload)
      )
      .subscribe();

    return () => {
      if (channel && supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [load]);

  const completeReserva = useCallback(async (id: string) => {
    const response = await fetch("/api/reservas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "complete" }),
    });
    const payload = (await response.json()) as ReservaActionResponse;
    if (!response.ok || !payload.reserva) {
      throw new Error(payload.error ?? "No se pudo completar la reserva");
    }
    setPendientes((prev) => prev.filter((item) => item.id !== id));
    setProcesadas((prev) => upsertReserva(prev, payload.reserva!, "procesadas").slice(0, 100));
    return payload.reserva;
  }, []);

  const rejectReserva = useCallback(async (id: string, rejectionReason: string) => {
    const response = await fetch("/api/reservas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "reject", rejectionReason }),
    });
    const payload = (await response.json()) as ReservaActionResponse;
    if (!response.ok || !payload.reserva) {
      throw new Error(payload.error ?? "No se pudo rechazar la reserva");
    }
    setPendientes((prev) => prev.filter((item) => item.id !== id));
    setProcesadas((prev) => upsertReserva(prev, payload.reserva!, "procesadas").slice(0, 100));
    return payload.reserva;
  }, []);

  const reopenReserva = useCallback(async (id: string) => {
    const response = await fetch("/api/reservas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "reopen" }),
    });
    const payload = (await response.json()) as ReservaActionResponse;
    if (!response.ok || !payload.reserva) {
      throw new Error(payload.error ?? "No se pudo devolver la reserva a pendientes");
    }
    setProcesadas((prev) => prev.filter((item) => item.id !== id));
    setPendientes((prev) => upsertReserva(prev, payload.reserva!, "pendientes"));
    return payload.reserva;
  }, []);

  return {
    pendientes,
    procesadas,
    pendingCount: pendientes.length,
    loading,
    error,
    refetch: load,
    completeReserva,
    rejectReserva,
    reopenReserva,
  };
}
