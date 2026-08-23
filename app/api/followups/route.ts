import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getGmailClient, createDraft } from "@/lib/gmailDraft";
import { getVerifiedEmail } from "@/lib/auth";

const DEFAULT_FOLLOWUP_DAYS = 3;

// GET /api/followups — list emails that are due for a follow-up
export async function GET(req: NextRequest) {
  const email = await getVerifiedEmail(req);
  if (!email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("sent_emails")
    .select("*")
    .eq("user_email", email)
    .eq("followup_generated", false)
    .order("drafted_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();
  const due = (data || []).filter((row) => {
    const draftedAt = new Date(row.drafted_at).getTime();
    const days = row.followup_days || DEFAULT_FOLLOWUP_DAYS;
    return now - draftedAt >= days * 24 * 60 * 60 * 1000;
  });

  return NextResponse.json({ due });
}

// POST /api/followups — user confirms a follow-up draft should be created
export async function POST(req: NextRequest) {
  try {
    const email = await getVerifiedEmail(req);
    if (!email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data: row } = await supabaseAdmin
      .from("sent_emails")
      .select("*")
      .eq("id", id)
      .eq("user_email", email)
      .single();

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const gmail = await getGmailClient(email);
    if (!gmail) {
      return NextResponse.json(
        { error: "Your Gmail account isn't connected", needsConnect: true },
        { status: 400 }
      );
    }

    const prompt = `You are writing a brief, polite follow-up to a cold email that was already sent and hasn't received a reply yet.

Original email that was sent:
"""
${row.original_email}
"""

Write a short follow-up (under 60 words) that:
- Politely references that this is a follow-up (e.g. "just following up on my note below" or similar, varied naturally)
- Does NOT repeat the full pitch — just a brief, low-pressure nudge
- Ends with an easy, low-friction question or CTA
- Do not use generic filler phrases or the exact phrase "just checking in"

Return ONLY valid JSON, no markdown, in this exact shape:
{"email": "..."}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "qwen/qwen3.6-27b",
        max_tokens: 200,
        temperature: 0.9,
        reasoning_effort: "none",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const rawText = data?.choices?.[0]?.message?.content || "{}";
    // Defense in depth: even with reasoning_effort:"none", strip any
    // <think>...</think> block the model might still emit, so it can
    // never leak into a real draft again.
    const withoutThinking = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const cleaned = withoutThinking.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = { email: cleaned };
        }
      } else {
        parsed = { email: cleaned };
      }
    }

    const followupText =
      parsed.email ||
      `Just following up on my note below — would love to hear your thoughts.\n\n---\n${row.original_email}`;

    await createDraft(
      gmail,
      row.lead_email,
      `Following up — ${row.lead_name}`,
      followupText
    );

    await supabaseAdmin
      .from("sent_emails")
      .update({ followup_generated: true })
      .eq("id", id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "Could not create follow-up: " + err.message },
      { status: 500 }
    );
  }
}

// DELETE /api/followups — dismiss a reminder without sending a follow-up
export async function DELETE(req: NextRequest) {
  try {
    const email = await getVerifiedEmail(req);
    if (!email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await supabaseAdmin
      .from("sent_emails")
      .update({ followup_generated: true }) // treat "dismissed" the same as "handled"
      .eq("id", id)
      .eq("user_email", email);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}