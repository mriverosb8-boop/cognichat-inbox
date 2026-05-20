"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Message } from "@/lib/inbox-types";
import { useConversationMessages } from "../hooks/useConversationMessages";
import type { Reserva } from "../lib/types";

type Props = {
  reserva: Reserva | null;
  onClose: () => void;
};

function MessageBubble({ message }: { message: Message }) {
  const isGuest = message.sender === "user";

  return (
    <div className={`flex ${isGuest ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[86%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed shadow-sm ring-1 ${
          isGuest
            ? "rounded-bl-md bg-[#f1ece4] text-[#1f1f1c] ring-[#e7dfd4]"
            : "rounded-br-md bg-[#e4edf5] text-[#1f1f1c] ring-[#c5d4e0]"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.body || (message.messageType === "image" ? "Imagen" : "—")}</p>
        <time className="mt-1 block text-[10px] font-medium text-[#6b665e]">{message.sentAt}</time>
      </div>
    </div>
  );
}

export function ChatPanel({ reserva, onClose }: Props) {
  const conversationId = reserva?.conversation_id || reserva?.quote_requests?.conversation_id || null;
  const guestPhone = reserva?.quote_requests?.sender_phone ?? null;
  const { conversation, messages, loading, error } = useConversationMessages({ conversationId, guestPhone });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, reserva?.id]);

  if (!reserva) {
    return (
      <aside className="flex h-full min-h-0 flex-col rounded-2xl border border-[#e7dfd4] bg-white p-5 shadow-sm ring-1 ring-black/[0.03]">
        <div className="flex flex-1 items-center justify-center text-center">
          <p className="max-w-[240px] text-[13px] leading-relaxed text-[#9c968c]">
            Selecciona “Ver chat” en una reserva para ver la conversación.
          </p>
        </div>
      </aside>
    );
  }

  const guestName = reserva.titular_nombre ?? conversation?.guest.name ?? "Huésped";

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#e7dfd4] bg-white shadow-sm ring-1 ring-black/[0.03]">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e7dfd4] px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-semibold text-[#1f1f1c]">{guestName}</h2>
          <p className="truncate text-[11px] text-[#9c968c]">Chat de WhatsApp · solo lectura</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#6b665e] transition hover:bg-[#f1ece4] hover:text-[#1f1f1c]"
          aria-label="Cerrar chat"
        >
          ×
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8f6f2] px-3 py-4 scrollbar-app">
        {loading ? (
          <p className="py-8 text-center text-[13px] text-[#6b665e]">Cargando conversación...</p>
        ) : error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-900">
            {error}
          </p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[#9c968c]">Sin mensajes cargados para esta conversación.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={bottomRef} className="h-px" aria-hidden />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[#e7dfd4] bg-white p-3">
        {conversationId ? (
          <Link
            href={`/?conversationId=${encodeURIComponent(conversationId)}`}
            className="flex w-full items-center justify-center rounded-xl border border-[#c5d4e0] bg-[#f8f6f2] px-3 py-2.5 text-[12px] font-semibold text-[#1f1f1c] transition hover:bg-[#f1ece4]"
          >
            Abrir en inbox
          </Link>
        ) : (
          <span className="block rounded-xl border border-[#e7dfd4] bg-[#f8f6f2] px-3 py-2.5 text-center text-[12px] text-[#9c968c]">
            {guestPhone ? "Abrir en inbox no disponible sin conversation_id" : "Reserva sin conversation_id ni teléfono"}
          </span>
        )}
      </div>
    </aside>
  );
}
