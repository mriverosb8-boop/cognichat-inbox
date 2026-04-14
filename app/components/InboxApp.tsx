"use client";

import type { SVGProps } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { avatarGradientClass, initials } from "@/lib/avatar";
import { formatMessageDetailTime } from "@/lib/chat-utils";
import type { Conversation, Message, OperationalStatus } from "@/lib/inbox-types";
import { useConversations } from "@/hooks/useConversations";

type StatusFilter = "all" | "unread" | "ai_active" | "requires_attention" | "closed";

const operationalConfig: Record<
  OperationalStatus,
  { label: string; short: string; dot: string; chip: string; listTint: string }
> = {
  ai_active: {
    label: "IA activa",
    short: "IA",
    dot: "bg-violet-400",
    chip: "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/35",
    listTint: "border-violet-500/20",
  },
  requires_attention: {
    label: "Requiere atención",
    short: "Atención",
    dot: "bg-amber-400",
    chip: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40",
    listTint: "border-amber-500/25",
  },
  closed: {
    label: "Completada",
    short: "Hecho",
    dot: "bg-zinc-500",
    chip: "bg-zinc-600/35 text-zinc-300 ring-1 ring-zinc-500/35",
    listTint: "border-zinc-600/30",
  },
};

function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function IconBack(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function IconGuest(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function IconSend(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0022.445-8.662a.75.75 0 000-1.5A60.517 60.517 0 003.478 2.404z" />
    </svg>
  );
}

function IconWhatsApp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.123 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconBuilding(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function IconGlobe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 18c-3.183 0-6.22-.62-9-1.745M16.5 6.5a16.023 16.023 0 00-9 0" />
    </svg>
  );
}

function IconCalendar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5" />
    </svg>
  );
}

function IconNote(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
    </svg>
  );
}

function IconTag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  );
}

function IconPhone(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function IconSparkles(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 3.37a3.75 3.75 0 002.576 2.576l3.38.813a.75.75 0 010 1.442l-3.38.813a3.75 3.75 0 00-2.576 2.576l-.813 3.37a.75.75 0 01-1.442 0l-.813-3.37a3.75 3.75 0 00-2.576-2.576l-3.38-.813a.75.75 0 010-1.442l3.38-.813a3.75 3.75 0 002.576-2.576l.813-3.37a.75.75 0 01.544-.721zm-4.5 12a.75.75 0 01.721.544l.415 1.725a1.5 1.5 0 001.031 1.031l1.725.415a.75.75 0 010 1.442l-1.725.415a1.5 1.5 0 00-1.031 1.031l-.415 1.725a.75.75 0 01-1.442 0l-.415-1.725a1.5 1.5 0 00-1.031-1.031l-1.725-.415a.75.75 0 010-1.442l1.725-.415a1.5 1.5 0 001.031-1.031l.415-1.725a.75.75 0 01.544-.721z" clipRule="evenodd" />
    </svg>
  );
}

function IconUserCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function Avatar({
  name,
  seed,
  size = "md",
}: {
  name: string;
  seed: string;
  size?: "sm" | "md" | "lg";
}) {
  const grad = avatarGradientClass(seed);
  const sizeClasses = {
    sm: "h-9 w-9 text-[11px] ring-2",
    md: "h-11 w-11 text-xs ring-2",
    lg: "h-16 w-16 text-lg ring-2",
  };
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-inner ring-black/20 ${grad} ${sizeClasses[size]}`}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

function MessageBubble({
  m,
  guestName,
  guestSeed,
}: {
  m: Message;
  guestName: string;
  guestSeed: string;
}) {
  const isUser = m.sender === "user";
  const isAi = m.sender === "ai";
  const isAgent = m.sender === "agent";

  const shell = isUser
    ? "mr-auto rounded-2xl rounded-bl-md border border-white/[0.08] bg-[#14161f] text-zinc-100 ring-1 ring-black/25"
    : isAi
      ? "ml-auto rounded-2xl rounded-br-md bg-gradient-to-br from-violet-600 to-indigo-700 text-white ring-1 ring-violet-400/25"
      : "ml-auto rounded-2xl rounded-br-md bg-gradient-to-br from-sky-600 to-cyan-700 text-white ring-1 ring-sky-400/30";

  const label = isAi ? "AI" : "Human";
  const LabelIcon = isAi ? IconSparkles : IconUserCircle;

  return (
    <div className={`flex w-full gap-2.5 ${isUser ? "justify-start" : "justify-end"}`}>
      {isUser && (
        <div className="mt-1 shrink-0">
          <Avatar name={guestName} seed={guestSeed} size="sm" />
        </div>
      )}
      <div className={`flex max-w-[min(100%,560px)] flex-col gap-1 ${isUser ? "items-start" : "items-end"}`}>
        {!isUser && (
          <span className="flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90 ring-1 ring-white/15">
            <LabelIcon className="h-3 w-3" aria-hidden />
            {label}
          </span>
        )}
        <div className={`flex flex-col gap-1.5 px-4 py-3 text-[14px] leading-relaxed shadow-lg ${shell}`}>
          {isUser && (
            <span className="inline-flex w-fit items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              Huésped
            </span>
          )}
          <p className="whitespace-pre-wrap">{m.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <time className={`text-[10px] font-medium tabular-nums ${isUser ? "text-zinc-500" : "text-white/70"}`}>
              {m.sentAt}
            </time>
            {isAi && m.aiMeta && (
              <span className="text-[10px] tabular-nums text-white/55">
                {m.aiMeta.latencyMs} ms · {m.aiMeta.tokens} tok
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InboxApp() {
  const { conversations, setConversations, loading, error, refetch } = useConversations();
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [draft, setDraft] = useState("");
  const [mobileTab, setMobileTab] = useState<"list" | "chat">("list");
  const [guestOpen, setGuestOpen] = useState(false);
  const [sendWarning, setSendWarning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActionError(null);
  }, [selectedId]);

  useEffect(() => {
    if (conversations.length === 0) return;
    setSelectedId((id) => {
      if (id && conversations.some((c) => c.id === id)) return id;
      return conversations[0]!.id;
    });
  }, [conversations]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const propertyOptions = useMemo(() => {
    const set = new Set(conversations.map((c) => c.guest.property));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [conversations]);

  const filterCounts = useMemo(() => {
    const all = conversations.length;
    const unread = conversations.filter((c) => c.unreadCount > 0).length;
    const ai_active = conversations.filter((c) => c.operationalStatus === "ai_active").length;
    const requires_attention = conversations.filter((c) => c.operationalStatus === "requires_attention").length;
    const closed = conversations.filter((c) => c.operationalStatus === "closed").length;
    return { all, unread, ai_active, requires_attention, closed };
  }, [conversations]);

  const filtered = useMemo(() => {
    let list = conversations;

    if (statusFilter === "unread") {
      list = list.filter((c) => c.unreadCount > 0);
    } else if (statusFilter === "ai_active") {
      list = list.filter((c) => c.operationalStatus === "ai_active");
    } else if (statusFilter === "requires_attention") {
      list = list.filter((c) => c.operationalStatus === "requires_attention");
    } else if (statusFilter === "closed") {
      list = list.filter((c) => c.operationalStatus === "closed");
    }

    if (propertyFilter !== "all") {
      list = list.filter((c) => c.guest.property === propertyFilter);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.guest.name.toLowerCase().includes(q) ||
          c.guestPhone.toLowerCase().includes(q) ||
          c.lastMessagePreview.toLowerCase().includes(q) ||
          c.guest.property.toLowerCase().includes(q)
      );
    }

    return list;
  }, [conversations, query, statusFilter, propertyFilter]);

  const scrollToBottom = useCallback(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useLayoutEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [selectedId, selected?.messages.length]);

  useEffect(() => {
    const t = setTimeout(() => scrollToBottom(), 100);
    return () => clearTimeout(t);
  }, [selected?.messages.length, scrollToBottom]);

  useEffect(() => {
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId && c.unreadCount > 0 ? { ...c, unreadCount: 0 } : c))
    );
  }, [selectedId, setConversations]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !selectedId) return;
    const selectedConv = conversations.find((c) => c.id === selectedId);
    if (selectedConv?.operationalStatus === "closed") return;

    const newMsg: Message = {
      id: `local-${Date.now()}`,
      body: text,
      sentAt: formatMessageDetailTime(new Date().toISOString()),
      sender: "agent",
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              messages: [...c.messages, newMsg],
              lastMessagePreview: text.length > 80 ? `${text.slice(0, 77)}…` : text,
              lastMessageAt: newMsg.sentAt,
              lastActivityIso: new Date().toISOString(),
              unreadCount: 0,
              controlMode: "human",
              needsHuman: true,
              aiActive: false,
              dbStatus: "human_control",
              operationalStatus:
                c.operationalStatus === "closed" ? "closed" : "requires_attention",
            }
          : c
      )
    );
    setDraft("");
    setSendWarning(null);
    setActionError(null);

    try {
      const res = await fetch("/api/send-human-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestPhone: selectedConv!.guestPhone,
          message: text,
          conversationId: selectedConv!.id,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; skipped?: boolean };
      if (!res.ok) {
        if (j.skipped) {
          setSendWarning(
            "N8N_SEND_MESSAGE_WEBHOOK_URL no está definida: el mensaje solo se muestra en la UI hasta que configures el webhook."
          );
        } else {
          setSendWarning(j.error ?? "No se pudo notificar a n8n");
        }
      }
    } catch {
      setSendWarning("Error de red al enviar a n8n");
    } finally {
      void refetch({ silent: true });
    }
  };

  const takeHumanControl = async () => {
    if (!selectedId) return;
    const conv = conversations.find((c) => c.id === selectedId);
    if (!conv) return;
    setActionError(null);
    try {
      const res = await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conv.id, action: "human_control" }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(j.error ?? "No se pudo actualizar la conversación");
        return;
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                controlMode: "human",
                needsHuman: true,
                aiActive: false,
                dbStatus: "human_control",
                operationalStatus: "requires_attention",
              }
            : c
        )
      );
      await refetch({ silent: true });
    } catch {
      setActionError("Error de red al actualizar la conversación");
    }
  };

  const reactivateAi = async () => {
    if (!selectedId) return;
    const conv = conversations.find((c) => c.id === selectedId);
    if (!conv || conv.operationalStatus === "closed") return;
    setActionError(null);
    try {
      const res = await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conv.id, action: "reactivate_ai" }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(j.error ?? "No se pudo reactivar la IA");
        return;
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                controlMode: "ai",
                needsHuman: false,
                aiActive: true,
                dbStatus: "open",
                operationalStatus: "ai_active",
              }
            : c
        )
      );
      await refetch({ silent: true });
    } catch {
      setActionError("Error de red al reactivar la IA");
    }
  };

  const markCompleted = async () => {
    if (!selectedId) return;
    const conv = conversations.find((c) => c.id === selectedId);
    if (!conv) return;
    setActionError(null);
    try {
      const res = await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conv.id, action: "completed" }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(j.error ?? "No se pudo marcar como completada");
        return;
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                operationalStatus: "closed",
                unreadCount: 0,
                dbStatus: "completed",
              }
            : c
        )
      );
      await refetch({ silent: true });
    } catch {
      setActionError("Error de red al completar la conversación");
    }
  };

  const openChat = (id: string) => {
    setSelectedId(id);
    setMobileTab("chat");
  };

  const filterTabs: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: "Todas", count: filterCounts.all },
    { id: "unread", label: "Sin leer", count: filterCounts.unread },
    { id: "ai_active", label: "IA activa", count: filterCounts.ai_active },
    { id: "requires_attention", label: "Atención", count: filterCounts.requires_attention },
    { id: "closed", label: "Hechas", count: filterCounts.closed },
  ];

  const inputLocked = selected?.operationalStatus === "closed";

  if (loading && conversations.length === 0) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-[#07080c] text-zinc-400">
        <p className="text-sm font-medium">Cargando conversaciones desde Supabase…</p>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#07080c] text-zinc-100">
      <header className="flex h-[52px] shrink-0 items-center border-b border-white/[0.07] bg-[#08090d]/95 px-4 backdrop-blur-xl lg:h-14 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-sm font-bold tracking-tight text-white shadow-lg shadow-emerald-950/50 ring-1 ring-white/10">
            C
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-white">CogniChat Inbox</h1>
            <p className="truncate text-[11px] leading-tight text-zinc-500">Recepción · IA + agente humano</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-lg bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium tabular-nums text-zinc-300 ring-1 ring-white/[0.08] sm:inline-flex">
            {filterCounts.unread} sin leer
          </span>
          <button
            type="button"
            onClick={() => void refetch({ silent: true })}
            className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-white/[0.08]"
          >
            Actualizar
          </button>
        </div>
      </header>

      {error && (
        <div className="shrink-0 border-b border-rose-500/30 bg-rose-950/40 px-4 py-2 text-center text-[13px] text-rose-100">
          {error}
        </div>
      )}

      {actionError && (
        <div className="shrink-0 border-b border-amber-500/30 bg-amber-950/35 px-4 py-2 text-center text-[13px] text-amber-100">
          {actionError}
          <button
            type="button"
            className="ml-2 underline decoration-amber-500/80 underline-offset-2"
            onClick={() => setActionError(null)}
          >
            Cerrar
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside
          className={`${
            mobileTab === "list" ? "flex" : "hidden"
          } w-full min-w-0 flex-col border-white/[0.06] bg-[#0b0c11] lg:flex lg:w-[min(100%,430px)] lg:shrink-0 lg:border-r`}
        >
          <div className="shrink-0 space-y-3 border-b border-white/[0.06] px-4 pb-4 pt-4">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h2 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-400">Cola operativa</h2>
                <p className="mt-0.5 text-[11px] text-zinc-600">Estado IA / prioridad / propiedad</p>
              </div>
              <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium tabular-nums text-zinc-400">
                {filtered.length}/{conversations.length}
              </span>
            </div>
            <label className="relative block">
              <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                placeholder="Buscar huésped, mensaje o hotel…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#12141c] py-3 pl-11 pr-3.5 text-[14px] text-zinc-100 placeholder:text-zinc-600 shadow-inner transition focus:border-emerald-500/45 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
              />
            </label>

            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filterTabs.map((tab) => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`shrink-0 rounded-lg px-2.5 py-2 text-[11px] font-medium transition sm:px-3 sm:text-[12px] ${
                      active
                        ? "bg-emerald-600/25 text-emerald-100 ring-1 ring-emerald-500/40"
                        : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-200"
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-1 tabular-nums sm:ml-1.5 ${active ? "text-emerald-200/90" : "text-zinc-600"}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div>
              <label htmlFor="property-filter" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Propiedad
              </label>
              <select
                id="property-filter"
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-xl border border-white/[0.08] bg-[#12141c] py-2.5 pl-3.5 pr-10 text-[13px] text-zinc-200 shadow-inner focus:border-emerald-500/45 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2371717a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.75rem center",
                  backgroundSize: "1rem",
                }}
              >
                <option value="all">Todas las propiedades</option>
                {propertyOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <p className="text-sm font-medium text-zinc-400">No hay conversaciones</p>
                <p className="max-w-[240px] text-[13px] leading-relaxed text-zinc-600">
                  Ajusta filtros o búsqueda.
                </p>
              </div>
            ) : (
              filtered.map((c) => {
                const active = c.id === selectedId;
                const op = operationalConfig[c.operationalStatus];
                const hasUnread = c.unreadCount > 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openChat(c.id)}
                    className={`group relative flex w-full gap-3.5 border-b border-white/[0.05] px-4 py-4 text-left transition ${
                      active
                        ? "z-[1] bg-emerald-950/40 ring-1 ring-inset ring-emerald-500/35 before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-full before:bg-emerald-400"
                        : `hover:bg-white/[0.03] ${op.listTint} border-l-2 border-l-transparent hover:border-l-white/10`
                    } ${hasUnread && !active ? "bg-amber-950/25" : ""}`}
                  >
                    <div className="relative shrink-0 pt-0.5">
                      <Avatar name={c.guest.name} seed={c.guest.id} size="md" />
                      {hasUnread && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-emerald-950/60 ring-2 ring-[#0b0c11]">
                          {c.unreadCount > 9 ? "9+" : c.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`truncate text-[15px] leading-tight ${hasUnread ? "font-semibold text-white" : "font-medium text-zinc-200"}`}
                        >
                          {c.guest.name}
                        </span>
                        <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-zinc-500">{c.lastMessageAt}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-zinc-500 group-hover:text-zinc-400">
                        {c.lastMessagePreview}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${op.chip}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${op.dot}`} aria-hidden />
                          {op.label}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            c.controlMode === "ai"
                              ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25"
                              : "bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/25"
                          }`}
                        >
                          {c.controlMode === "ai" ? "Modo IA" : "Humano"}
                        </span>
                        <span className="truncate text-[11px] text-zinc-600" title={c.guest.property}>
                          {c.guest.property.split("—")[0]?.trim()}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section
          className={`${
            mobileTab === "chat" ? "flex" : "hidden"
          } min-w-0 flex-1 flex-col bg-[#06070a] lg:flex`}
        >
          {selected ? (
            <>
              <div className="flex min-h-[56px] shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#08090d]/95 px-2 py-2 backdrop-blur-md sm:gap-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => setMobileTab("list")}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
                  aria-label="Volver a conversaciones"
                >
                  <IconBack className="h-5 w-5" />
                </button>
                <div className="rounded-xl p-0.5 ring-2 ring-emerald-500/45">
                  <Avatar name={selected.guest.name} seed={selected.guest.id} size="sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-[15px] font-semibold text-white">{selected.guest.name}</h2>
                    <span
                      className={`hidden shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:inline-flex ${operationalConfig[selected.operationalStatus].chip}`}
                    >
                      {operationalConfig[selected.operationalStatus].short}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        selected.controlMode === "ai"
                          ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/30"
                          : "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/30"
                      }`}
                    >
                      {selected.controlMode === "ai" ? "IA" : "Agente"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-emerald-400/95">
                    <IconWhatsApp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{selected.channelLabel}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGuestOpen(true)}
                  className="flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-[12px] font-semibold text-zinc-300 transition hover:bg-white/[0.06] lg:hidden"
                >
                  <IconGuest className="h-4 w-4" />
                  Ficha
                </button>
              </div>

              {inputLocked && (
                <div className="shrink-0 border-b border-zinc-700/50 bg-zinc-900/80 px-4 py-2 text-center text-[12px] text-zinc-400">
                  Conversación cerrada · reabre desde la ficha si necesitas seguir el hilo (demo)
                </div>
              )}

              <div
                className="min-h-0 flex-1 overflow-y-auto px-3 py-6 sm:px-8"
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse 90% 45% at 50% -15%, rgba(139,92,246,0.06), transparent), linear-gradient(180deg, #06070a 0%, #080a10 50%, #06070a 100%)",
                }}
              >
                <div className="mx-auto max-w-3xl space-y-4">
                  <p className="text-center text-[11px] font-medium uppercase tracking-widest text-zinc-600">
                    Historial desde Supabase · IA vs humano es heurístico sin columna dedicada
                  </p>
                  {selected.messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      m={m}
                      guestName={selected.guest.name}
                      guestSeed={selected.guest.id}
                    />
                  ))}
                  <div ref={scrollEndRef} className="h-px w-full shrink-0" aria-hidden />
                </div>
              </div>

              <div className="shrink-0 border-t border-white/[0.07] bg-[#08090d] px-3 py-4 sm:px-6">
                {sendWarning && (
                  <p className="mx-auto mb-3 max-w-3xl rounded-lg border border-amber-500/25 bg-amber-950/30 px-3 py-2 text-[12px] text-amber-100">
                    {sendWarning}
                  </p>
                )}
                <div className="mx-auto flex max-w-3xl gap-3">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    disabled={inputLocked}
                    placeholder={
                      inputLocked
                        ? "Conversación completada"
                        : "Responder como agente humano… (Enter para enviar)"
                    }
                    className="min-h-[48px] flex-1 rounded-2xl border border-white/[0.1] bg-[#12141c] px-5 text-[14px] text-zinc-100 placeholder:text-zinc-600 shadow-inner transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/15 disabled:cursor-not-allowed disabled:opacity-45"
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={!draft.trim() || inputLocked}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-cyan-700 text-white shadow-lg shadow-sky-950/40 ring-1 ring-sky-400/25 transition hover:from-sky-500 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Enviar"
                  >
                    <IconSend className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm font-medium text-zinc-500">Selecciona una conversación</p>
              <p className="max-w-xs text-[13px] text-zinc-600">Cola unificada con estados IA y prioridad.</p>
            </div>
          )}
        </section>

        <aside className="hidden w-[400px] shrink-0 flex-col border-l border-white/[0.07] bg-[#0a0b10] lg:flex">
          {selected && (
            <GuestPanelContent
              conversation={selected}
              onTakeHuman={takeHumanControl}
              onReactivateAi={reactivateAi}
              onComplete={markCompleted}
            />
          )}
        </aside>
      </div>

      {guestOpen && selected && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Cerrar"
            onClick={() => setGuestOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/[0.1] bg-[#0a0b10] shadow-2xl shadow-black/50">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
              <span className="text-[15px] font-semibold text-white">Ficha operativa</span>
              <button
                type="button"
                onClick={() => setGuestOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Cerrar panel"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <GuestPanelContent
                conversation={selected}
                onTakeHuman={takeHumanControl}
                onReactivateAi={reactivateAi}
                onComplete={markCompleted}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TAG_STYLES = [
  "bg-sky-500/15 text-sky-200 ring-sky-500/25",
  "bg-violet-500/15 text-violet-200 ring-violet-500/25",
  "bg-amber-500/15 text-amber-200 ring-amber-500/25",
  "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25",
  "bg-rose-500/15 text-rose-200 ring-rose-500/25",
  "bg-cyan-500/15 text-cyan-200 ring-cyan-500/25",
];

function formatActivityIso(iso: string) {
  try {
    return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function GuestPanelContent({
  conversation,
  onTakeHuman,
  onReactivateAi,
  onComplete,
}: {
  conversation: Conversation;
  onTakeHuman: () => void;
  onReactivateAi: () => void;
  onComplete: () => void;
}) {
  const { guest } = conversation;
  const grad = avatarGradientClass(guest.id);
  const op = operationalConfig[conversation.operationalStatus];
  const hasTags = guest.tags.length > 0;
  const notesAreDefault = guest.internalNotes.startsWith("Sin notas");

  return (
    <div className="flex h-full flex-col">
      <div className={`relative shrink-0 overflow-hidden bg-gradient-to-br px-5 pb-5 pt-7 ${grad} ring-1 ring-white/10`}>
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,11,16,0.94),transparent)]" />
        <div className="relative flex flex-col items-center text-center">
          <div
            className={`flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-gradient-to-br text-2xl font-bold tracking-tight text-white shadow-xl ring-2 ring-white/25 ${grad}`}
          >
            {initials(guest.name)}
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-tight text-white drop-shadow-sm">{guest.name}</h3>
          <p className="mt-1 font-mono text-[12px] text-white/75">{guest.phone}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${op.chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${op.dot}`} />
              {op.label}
            </span>
            <span
              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${
                conversation.controlMode === "ai"
                  ? "bg-violet-950/50 text-violet-200 ring-1 ring-violet-500/30"
                  : "bg-sky-950/50 text-sky-200 ring-1 ring-sky-500/30"
              }`}
            >
              {conversation.controlMode === "ai" ? "Control IA" : "Control humano"}
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-b border-white/[0.07] bg-[#0c0d14] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Acciones rápidas</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onTakeHuman}
            disabled={conversation.operationalStatus === "closed"}
            className="w-full rounded-xl bg-amber-600/90 py-2.5 text-[12px] font-semibold text-white shadow-lg shadow-amber-950/30 ring-1 ring-amber-400/30 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Tomar control humano
          </button>
          <button
            type="button"
            onClick={onReactivateAi}
            disabled={conversation.operationalStatus === "closed"}
            className="w-full rounded-xl border border-violet-500/35 bg-violet-950/40 py-2.5 text-[12px] font-semibold text-violet-100 transition hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reactivar IA
          </button>
          <button
            type="button"
            onClick={onComplete}
            disabled={conversation.operationalStatus === "closed"}
            className="w-full rounded-xl border border-zinc-600 bg-zinc-800/80 py-2.5 text-[12px] font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Marcar como completado
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-950/15 p-4 ring-1 ring-emerald-500/15">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-400/95">
            <IconPhone className="h-4 w-4" aria-hidden />
            Datos de conversación
          </div>
          <dl className="mt-3 space-y-2.5 text-[13px] text-zinc-200">
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Teléfono</dt>
              <dd className="max-w-[55%] text-right font-mono text-[12px] text-emerald-100">{guest.phone}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Última actividad</dt>
              <dd className="text-right text-[12px]">{formatActivityIso(conversation.lastActivityIso)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Mensajes (cargados)</dt>
              <dd className="tabular-nums">{conversation.messages.length}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Needs Human (BD)</dt>
              <dd>{conversation.needsHuman ? "Sí" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">IA activa (BD)</dt>
              <dd>{conversation.aiActive ? "Sí" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Estado (BD)</dt>
              <dd className="max-w-[55%] text-right font-mono text-[11px] text-zinc-300">
                {conversation.dbStatus ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Bloqueado</dt>
              <dd>{conversation.blocked ? "Sí" : "No"}</dd>
            </div>
            {conversation.blockedAt && (
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">blocked_at</dt>
                <dd className="text-right text-[11px] text-zinc-400">{formatActivityIso(conversation.blockedAt)}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-[#12131a] p-4 shadow-inner ring-1 ring-white/[0.03]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <IconBuilding className="h-4 w-4 text-emerald-500/90" aria-hidden />
            Cotización / propiedad
          </div>
          <p className="mt-2.5 text-[14px] font-medium leading-snug text-zinc-100">{guest.property}</p>
        </section>

        {!notesAreDefault && (
          <section className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-4 ring-1 ring-amber-500/15">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-400/95">
              <IconNote className="h-4 w-4" aria-hidden />
              Notas (tabla / handoff)
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-amber-100/95">{guest.internalNotes}</p>
          </section>
        )}

        {hasTags && (
          <section className="rounded-2xl border border-white/[0.06] bg-[#12131a] p-4 shadow-inner ring-1 ring-white/[0.03]">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <IconTag className="h-4 w-4 text-violet-400/90" aria-hidden />
              Etiquetas
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {guest.tags.map((tag, i) => (
                <span
                  key={tag}
                  className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold ring-1 ${TAG_STYLES[i % TAG_STYLES.length]}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        <div className="flex gap-2 pb-2">
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(guest.phone)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/[0.06] py-2.5 text-[11px] font-semibold text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <IconPhone className="h-4 w-4" />
            Copiar teléfono
          </button>
        </div>

        <p className="pb-2 text-center text-[10px] text-zinc-600">CogniChat · Supabase + n8n</p>
      </div>
    </div>
  );
}
