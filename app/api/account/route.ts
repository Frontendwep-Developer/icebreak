import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getVerifiedEmail, getVerifiedUser } from "@/lib/auth";

const FREE_MONTHLY_LIMIT = 10;
const PRO_MONTHLY_LIMIT = 500;
const TEMPLATE_MONTHLY_LIMIT = 200;

// GET /api/account — account overview for the profile page
export async function GET(req: NextRequest) {
  const email = await getVerifiedEmail(req);
  if (!email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (!user) {
    // Not an error — this email just hasn't generated anything yet.
    return NextResponse.json({
      exists: false,
      plan: "free",
      creditsUsed: 0,
      limit: FREE_MONTHLY_LIMIT,
      templateCreditsUsed: 0,
      templateLimit: TEMPLATE_MONTHLY_LIMIT,
      gmailConnected: false,
    });
  }

  return NextResponse.json({
    exists: true,
    plan: user.plan || "free",
    creditsUsed: user.credits_used || 0,
    limit: user.plan === "pro" ? PRO_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT,
    templateCreditsUsed: user.template_credits_used || 0,
    templateLimit: TEMPLATE_MONTHLY_LIMIT,
    gmailConnected: !!user.google_refresh_token,
    defaultFollowupDays: user.default_followup_days || 3,
  });
}

// POST /api/account — update account-level settings (currently: follow-up days, disconnect Gmail)
export async function POST(req: NextRequest) {
  try {
    const email = await getVerifiedEmail(req);
    if (!email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { action, defaultFollowupDays } = await req.json();

    if (action === "disconnect_gmail") {
      await supabaseAdmin
        .from("users")
        .update({ google_refresh_token: null })
        .eq("email", email);
      return NextResponse.json({ success: true });
    }

    if (typeof defaultFollowupDays === "number") {
      await supabaseAdmin
        .from("users")
        .update({ default_followup_days: defaultFollowupDays })
        .eq("email", email);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/account — permanently delete the current user's account and data
export async function DELETE(req: NextRequest) {
  try {
    const user = await getVerifiedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Delete data tied to this email across our own tables. Best-effort —
    // we still proceed to delete the Auth user even if one of these fails,
    // rather than leaving the account stuck.
    await supabaseAdmin.from("generation_history").delete().eq("user_email", user.email);
    await supabaseAdmin.from("sent_emails").delete().eq("user_email", user.email);
    await supabaseAdmin.from("users").delete().eq("email", user.email);

    // Finally, delete the Supabase Auth user itself.
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (authDeleteError) {
      return NextResponse.json({ error: authDeleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}