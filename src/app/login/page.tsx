import { LoginForm } from "./login-form";

// Never statically prerender the login page — it builds the Supabase
// browser client, which must run at request time (not during `next build`).
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-lg">
        <div className="mb-6">
          <div className="text-xl font-semibold tracking-tight">Vyonix</div>
          <p className="text-sm text-muted-foreground">Business Manager</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
