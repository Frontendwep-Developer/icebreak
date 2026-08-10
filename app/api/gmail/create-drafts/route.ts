import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ResultItem = {
  lead: { name: string; company: string; context: string; email: string };
  opener: string;
  email: string;
};

export async function POST(req: NextRequest) {
  try {
    const { email, results } = await req.json();

    if (!email || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: "email and results are required" },
        { status: 400 }
      );
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("google_refresh_token")
      .eq("email", email)
      .single();

    if (!user?.google_refresh_token) {
      return NextResponse.json(
        { error: "Your Gmail account isn't connected", needsConnect: true },
        { status: 400 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
    );
    oauth2Client.setCredentials({
      refresh_token: user.google_refresh_token,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    let created = 0;
    for (const r of results as ResultItem[]) {
      const messageParts = [
        `To: ${r.lead.email || ""}`,
        `Subject: Quick question, ${r.lead.name}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        r.email,
      ];
      const message = messageParts.join("\n");

      const encodedMessage = Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      await gmail.users.drafts.create({
        userId: "me",
        requestBody: {
          message: { raw: encodedMessage },
        },
      });
      created++;
    }

    return NextResponse.json({ created });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "Could not create draft: " + err.message },
      { status: 500 }
    );
  }
}
