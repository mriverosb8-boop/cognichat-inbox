"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function sanitizeNextPath(raw: string | null | undefined) {
  const t = raw?.trim() || "/";
  return t.startsWith("/") && !t.startsWith("//") ? t : "/";
}

export function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signError) {
      setError(signError.message);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const next = sanitizeNextPath(params.get("next"));
    router.push(next);
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="w-full max-w-[380px] space-y-5 rounded-2xl border border-[#e7dfd4] bg-white p-8 shadow-[0_8px_30px_-12px_rgba(31,31,28,0.08)] ring-1 ring-black/[0.03]"
    >
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-[#1f1f1c]">Iniciar sesión</h1>
        <p className="text-[13px] text-[#6b665e]">Accede al inbox con tu cuenta de CogniChat.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-900">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6b665e]">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[#e7dfd4] bg-[#f8f6f2] px-3 py-2.5 text-[14px] text-[#1f1f1c] outline-none ring-[#c8a97e]/0 transition placeholder:text-[#9c968c] focus:border-[#c8a97e] focus:bg-white focus:ring-2 focus:ring-[#c8a97e]/25"
            placeholder="tu@email.com"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6b665e]">Contraseña</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-[#e7dfd4] bg-[#f8f6f2] px-3 py-2.5 text-[14px] text-[#1f1f1c] outline-none ring-[#c8a97e]/0 transition placeholder:text-[#9c968c] focus:border-[#c8a97e] focus:bg-white focus:ring-2 focus:ring-[#c8a97e]/25"
            placeholder="••••••••"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#c8a97e] to-[#b89a6e] py-2.5 text-[14px] font-semibold text-white shadow-md shadow-[#c8a97e]/25 transition hover:from-[#b89a6e] hover:to-[#a88b60] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
