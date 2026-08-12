import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Groq's free tier caps out around ~170 requests/day (token-bound) and
// 30 requests/minute. We stay under those with a safety buffer, and only
// apply this to free-plan users — Pro subscribers are exempt so a paying
// customer's experience is never interrupted by free-tier limits.
const DAY_SAFE_LIMIT = 150;
const MINUTE_SAFE_LIMIT = 25;

type CapacityResult =
  | { ok: true }
  | { ok: false; reason: "day" | "minute" };

export async function checkGroqCapacity(plan: string): Promise<CapacityResult> {
  // Pro users are never blocked by this safeguard.
  if (plan === "pro") return { ok: true };

  const now = new Date();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const minuteKey = `${today}T${now.getHours()}:${now.getMinutes()}`;

  const { data: row } = await supabaseAdmin
    .from("api_usage")
    .select("*")
    .eq("id", 1)
    .single();

  if (!row) {
    // Table row missing for some reason — fail open rather than blocking everyone.
    return { ok: true };
  }

  let dayCount = row.day === today ? row.day_count : 0;
  let minuteCount = row.minute_key === minuteKey ? row.minute_count : 0;

  if (dayCount >= DAY_SAFE_LIMIT) {
    return { ok: false, reason: "day" };
  }
  if (minuteCount >= MINUTE_SAFE_LIMIT) {
    return { ok: false, reason: "minute" };
  }

  dayCount += 1;
  minuteCount += 1;

  await supabaseAdmin
    .from("api_usage")
    .update({
      day: today,
      day_count: dayCount,
      minute_key: minuteKey,
      minute_count: minuteCount,
    })
    .eq("id", 1);

  return { ok: true };
}