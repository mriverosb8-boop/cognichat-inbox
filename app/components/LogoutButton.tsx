"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={loading}
      className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-rose-500/30 hover:bg-rose-950/30 hover:text-rose-200 disabled:opacity-50"
    >
      {loading ? "…" : "Cerrar sesión"}
    </button>
  );
}
