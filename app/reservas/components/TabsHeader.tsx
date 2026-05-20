"use client";

import type { ReservasTab } from "../lib/types";

type Props = {
  activeTab: ReservasTab;
  pendingCount: number;
  processedCount: number;
  onChange: (tab: ReservasTab) => void;
};

export function TabsHeader({ activeTab, pendingCount, processedCount, onChange }: Props) {
  const tabs: { id: ReservasTab; label: string; count: number }[] = [
    { id: "pendientes", label: "Pendientes", count: pendingCount },
    { id: "procesadas", label: "Procesadas", count: processedCount },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7dfd4] bg-white/80 px-4 py-3">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#6b665e]">
          Reservas por subir a Opera
        </h2>
        <p className="mt-0.5 text-[12px] text-[#9c968c]">Ibis Barranquilla · WhatsApp Flows</p>
      </div>
      <div className="flex gap-1.5 rounded-xl border border-[#e7dfd4] bg-[#f8f6f2] p-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                active
                  ? "border border-[#c8a97e]/50 bg-white text-[#1f1f1c] shadow-sm ring-1 ring-[#c8a97e]/20"
                  : "border border-transparent text-[#6b665e] hover:bg-white/70"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 font-mono text-[11px] ${active ? "text-[#8a7a62]" : "text-[#9c968c]"}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
