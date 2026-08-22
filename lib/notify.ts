/**
 * Sends a simple notification email via Resend. Used to alert the site
 * owner about events they need to act on manually (e.g. a new Pro
 * subscriber who needs to be added to Google's OAuth Test Users list).
 * Fails silently — a notification issue should never break the actual
 * user-facing flow (checkout, signup, etc).
 */
export async function sendNotificationEmail(subject: string, body: string) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Icebreak <onboarding@resend.dev>",
        to: process.env.NOTIFY_EMAIL,
        subject,
        text: body,
      }),
    });
  } catch (err) {
    console.error("Notification email failed:", err);
  }
}