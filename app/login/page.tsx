import { BrandHeaderMark } from "../components/BrandHeaderMark";
import { LoginForm } from "./login-form";

/** Página síncrona: el `?next=` se lee en el cliente para evitar bloqueos con searchParams/async en Next 16. */
export default function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f7f4ee] px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <BrandHeaderMark size="md" />
        <p className="text-[13px] text-[#6b665e]">FerrarIA Inbox</p>
      </div>
      <LoginForm />
    </div>
  );
}
