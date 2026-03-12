"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signIn(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function promoteUser(formData: FormData): Promise<void> {
  const targetUserId = formData.get("targetUserId");

  if (!targetUserId || typeof targetUserId !== "string" || targetUserId.trim() === "") {
    throw new Error("Invalid user ID");
  }

  const supabase = await createClient();

  // Verify caller is super_admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("global_role")
    .eq("id", user.id)
    .single();

  if (!callerProfile || callerProfile.global_role !== "super_admin") {
    throw new Error("Insufficient permissions");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ global_role: "super_admin" })
    .eq("id", targetUserId.trim());

  if (error) throw new Error(error.message);

  console.log(
    `[promoteUser] actor=${user.id} (${callerProfile.global_role}) promoted target=${targetUserId.trim()} to super_admin`
  );

  revalidatePath("/admin/users");
}
