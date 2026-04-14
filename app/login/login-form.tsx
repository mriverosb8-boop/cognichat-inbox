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
      className="w-full max-w-[380px] space-y-5 rounded-2xl border border-white/[0.08] bg-[#0d0e14] p-8 shadow-2xl shadow-black/40 ring-1 ring-white/[0.04]"
    >
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-white">Iniciar sesión</h1>
        <p className="text-[13px] text-zinc-500">Accede al inbox con tu cuenta de CogniChat.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/35 bg-rose-950/50 px-3 py-2 text-[13px] text-rose-100">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/[0.1] bg-[#08090d] px-3 py-2.5 text-[14px] text-white outline-none ring-emerald-500/0 transition placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/25"
            placeholder="tu@email.com"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Contraseña</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/[0.1] bg-[#08090d] px-3 py-2.5 text-[14px] text-white outline-none ring-emerald-500/0 transition placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/25"
            placeholder="••••••••"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:from-emerald-500 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
