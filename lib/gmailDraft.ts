import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function getGmailClient(userEmail: string) {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("google_refresh_token")
    .eq("email", userEmail)
    .single();

  if (!user?.google_refresh_token) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
  );
  oauth2Client.setCredentials({ refresh_token: user.google_refresh_token });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

export async function createDraft(
  gmail: any,
  to: string,
  subject: string,
  bodyText: string
) {
  const messageParts = [
    `To: ${to || ""}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    bodyText,
  ];
  const message = messageParts.join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw: encodedMessage } },
  });
}