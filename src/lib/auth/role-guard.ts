import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export async function requireAuth(): Promise<Profile> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    console.error(
      `[requireAuth] Profile missing for authenticated user: ${user.id}. ` +
        "This may indicate the handle_new_user trigger did not fire. " +
        "Check Supabase logs and ensure the migration was applied."
    );
    redirect("/login");
  }

  return profile as Profile;
}

export async function requireSuperAdmin(): Promise<Profile> {
  const profile = await requireAuth();

  if (profile.global_role !== "super_admin") {
    redirect("/dashboard");
  }

  return profile;
}
