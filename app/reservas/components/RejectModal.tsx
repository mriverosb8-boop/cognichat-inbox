"use client";

import { useState } from "react";
import { formatCOT } from "../lib/formatters";
import type { Reserva } from "../lib/types";

type Props = {
  reserva: Reserva | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export function RejectModal({ reserva, submitting, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");

  if (!reserva) return null;

  const canSubmit = reason.trim().length > 0 && !submitting;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-[#1f1f1c]/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-[#e7dfd4] bg-white p-5 shadow-2xl shadow-[#1f1f1c]/15 ring-1 ring-black/[0.04]">
        <h2 className="text-lg font-semibold tracking-tight text-[#1f1f1c]">
          Rechazar reserva {formatCOT(reserva.quote_request_id)}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6b665e]">
          Esta acción marcará la reserva como rechazada. Indica el motivo:
        </p>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Ej: No hay disponibilidad para esas fechas"
          className="mt-4 min-h-28 w-full resize-none rounded-xl border border-[#e7dfd4] bg-[#f8f6f2] px-3 py-2.5 text-sm text-[#1f1f1c] outline-none transition placeholder:text-[#9c968c] focus:border-[#c8a97e] focus:bg-white focus:ring-2 focus:ring-[#c8a97e]/20"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-[#e7dfd4] bg-white px-4 py-2 text-[13px] font-semibold text-[#6b665e] transition hover:bg-[#f1ece4] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            disabled={!canSubmit}
            className="rounded-xl bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm ring-1 ring-rose-700/30 transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Rechazando..." : "Rechazar reserva"}
          </button>
        </div>
      </div>
    </div>
  );
}
