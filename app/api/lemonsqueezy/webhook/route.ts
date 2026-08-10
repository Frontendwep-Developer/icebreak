import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

// Lemon Squeezy'dagi holatlar: on_trial, active, paused, past_due, unpaid, cancelled, expired
const PRO_STATUSES = ["on_trial", "active"];

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Noto'g'ri signature" }, { status: 401 });
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
    await supabaseAdmin.from("users").upsert(
      {
        email,
        plan: PRO_STATUSES.includes(status) ? "pro" : "free",
      },
      { onConflict: "email" }
    );
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
