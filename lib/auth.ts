import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type VerifiedUser = { id: string; email: string };

/**
 * Verifies the Supabase session token sent by the frontend and returns the
 * authenticated user's id + email — or null if the request isn't
 * authenticated. Also keeps our `users` table in sync with Supabase Auth:
 * - Links an existing row to this auth user (by user_id) the first time
 *   we see them after the user_id column was added.
 * - If the person changed their email in Auth, updates our row's email to
 *   match, so their plan/credits/Gmail connection follow them to the new
 *   address instead of silently orphaning the old row.
 */
export async function getVerifiedUser(req: NextRequest): Promise<VerifiedUser | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.email) return null;

  const authUser: VerifiedUser = { id: data.user.id, email: data.user.email };

  // Sync with our `users` table (best-effort — never blocks the request).
  try {
    const { data: linked } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (linked) {
      if (linked.email !== authUser.email) {
        // Auth email changed since we last saw this user — follow it.
        await supabaseAdmin
          .from("users")
          .update({ email: authUser.email })
          .eq("user_id", authUser.id);
      }
    } else {
      // Not linked yet — try to claim a legacy row that matches by email.
      const { data: legacy } = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("email", authUser.email)
        .is("user_id", null)
        .maybeSingle();

      if (legacy) {
        await supabaseAdmin
          .from("users")
          .update({ user_id: authUser.id })
          .eq("email", authUser.email);
      }
    }
  } catch (err) {
    console.error("users table sync failed:", err);
  }

  return authUser;
}

/** Convenience wrapper for routes that only need the verified email. */
export async function getVerifiedEmail(req: NextRequest): Promise<string | null> {
  const user = await getVerifiedUser(req);
  return user?.email ?? null;
}