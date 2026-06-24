import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell/app-shell";

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
    <AppShell
      isOwner={isOwner}
      perms={perms}
      name={profile?.name ?? user.email ?? "User"}
      role={profile?.role ?? "—"}
    >
      {children}
    </AppShell>
  );
}
