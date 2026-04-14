import { LoginForm } from "./login-form";

/** Página síncrona: el `?next=` se lee en el cliente para evitar bloqueos con searchParams/async en Next 16. */
export default function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f7f4ee] px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d4c4a8] to-[#c8a97e] text-lg font-bold text-white shadow-md shadow-[#c8a97e]/25 ring-1 ring-[#e7dfd4]">
          C
        </div>
        <p className="text-[13px] text-[#6b665e]">CogniChat Inbox</p>
      </div>
      <LoginForm />
    </div>
  );
}
