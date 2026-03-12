import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Recovery links → go to update-password page
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/update-password`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
