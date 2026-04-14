import { LoginForm } from "./login-form";

/** Página síncrona: el `?next=` se lee en el cliente para evitar bloqueos con searchParams/async en Next 16. */
export default function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0a0b0f] px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-lg font-bold text-white shadow-lg shadow-emerald-950/50 ring-1 ring-white/10">
          C
        </div>
        <p className="text-[13px] text-zinc-500">CogniChat Inbox</p>
      </div>
      <LoginForm />
    </div>
  );
}
