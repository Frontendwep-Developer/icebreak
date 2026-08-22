import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendNotificationEmail } from "@/lib/notify";

function verifySignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const hmac = crypto.createHmac(
    "sha256",
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET!
  );
  const digest = hmac.update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}

// Lemon Squeezy subscription statuses: on_trial, active, paused, past_due, unpaid, cancelled, expired
const PRO_STATUSES = ["on_trial", "active"];

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventName = payload?.meta?.event_name;
  const email =
    payload?.meta?.custom_data?.user_email ||
    payload?.data?.attributes?.user_email;
  const status = payload?.data?.attributes?.status;

  if (
    email &&
    [
      "subscription_created",
      "subscription_updated",
      "subscription_resumed",
      "subscription_unpaused",
    ].includes(eventName)
  ) {
    const isNowPro = PRO_STATUSES.includes(status);

    // Check the current plan BEFORE we update, so we only notify once —
    // the moment someone actually becomes Pro, not on every later webhook
    // (renewals, etc. fire this same event repeatedly).
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("plan")
      .eq("email", email)
      .maybeSingle();

    const wasAlreadyPro = existing?.plan === "pro";

    await supabaseAdmin.from("users").upsert(
      {
        email,
        plan: isNowPro ? "pro" : "free",
      },
      { onConflict: "email" }
    );

    if (isNowPro && !wasAlreadyPro) {
      await sendNotificationEmail(
        "🎉 New Pro subscriber on Icebreak",
        `${email} just became a Pro subscriber.\n\nDon't forget to add them as a Google OAuth Test User if they want Gmail auto-drafts:\nhttps://console.cloud.google.com/auth/audience`
      );
    }
  }

  if (
    email &&
    [
      "subscription_cancelled",
      "subscription_expired",
      "subscription_paused",
    ].includes(eventName)
  ) {
    await supabaseAdmin.from("users").update({ plan: "free" }).eq("email", email);
  }

  return NextResponse.json({ received: true });
}