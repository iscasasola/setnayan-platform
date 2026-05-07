"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const email = formData.get("email")?.toString().trim();

  if (!email) {
    redirect("/login?error=" + encodeURIComponent("Email is required."));
  }

  const supabase = await createClient();
  const headersList = await headers();
  const host = headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirect("/login?error=" + encodeURIComponent(error.message));
  }

  redirect(
    "/login?message=" +
      encodeURIComponent("Check your email for the sign-in link. (Check spam if you don't see it.)"),
  );
}
