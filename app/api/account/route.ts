import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getVerifiedEmail } from "@/lib/auth";

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