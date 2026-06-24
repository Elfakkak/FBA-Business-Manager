import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app-shell/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, role, is_owner, section_perms")
    .eq("auth_uid", user.id)
    .maybeSingle();

  const isOwner = !!(profile?.is_owner || profile?.role === "Owner");
  const perms = (profile?.section_perms ?? {}) as Record<string, boolean>;

  return (
    <div className="flex min-h-screen">
      <Sidebar isOwner={isOwner} perms={perms} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{profile?.name ?? user.email}</span>
            <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
              {profile?.role ?? "—"}
            </span>
          </div>
          <form action="/auth/signout" method="post">
            <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">Sign out</button>
          </form>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
