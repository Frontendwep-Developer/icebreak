import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getGmailClient, createDraft } from "@/lib/gmailDraft";

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

    const gmail = await getGmailClient(email);
    if (!gmail) {
      return NextResponse.json(
        { error: "Your Gmail account isn't connected", needsConnect: true },
        { status: 400 }
      );
    }

    let created = 0;
    for (const r of results as ResultItem[]) {
      await createDraft(
        gmail,
        r.lead.email,
        `Quick question, ${r.lead.name}`,
        r.email
      );
      created++;

      // Track this so we can offer a follow-up reminder later.
      await supabaseAdmin.from("sent_emails").insert({
        user_email: email,
        lead_name: r.lead.name,
        lead_company: r.lead.company,
        lead_email: r.lead.email,
        lead_context: r.lead.context,
        original_email: r.email,
      });
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