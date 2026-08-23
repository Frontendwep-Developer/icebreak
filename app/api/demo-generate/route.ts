import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkGroqCapacity } from "@/lib/rateGuard";

export const maxDuration = 30;

const GUEST_DAILY_LIMIT = 10;
const MAX_LEADS_PER_REQUEST = 5;

type Lead = { name: string; company: string; context: string; email: string };

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

async function callGroq(prompt: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "qwen/qwen3.6-27b",
      max_tokens: 400,
      temperature: 0.9,
      reasoning_effort: "none",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "{}";
  const withoutThinking = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const cleaned = withoutThinking.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return { opener: "", email: cleaned };
      }
    }
    return { opener: "", email: cleaned };
  }
}

export async function POST(req: NextRequest) {
  if (process.env.ALLOW_GUEST_MODE !== "true") {
    return NextResponse.json(
      { error: "Guest mode is currently disabled — please sign up to try Icebreak." },
      { status: 403 }
    );
  }

  try {
    const { leads, productDescription, tone } = await req.json();

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: "leads are required" }, { status: 400 });
    }
    if (!productDescription || !productDescription.trim()) {
      return NextResponse.json(
        { error: "Please describe your product" },
        { status: 400 }
      );
    }
    if (leads.length > MAX_LEADS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Guest demo is limited to ${MAX_LEADS_PER_REQUEST} leads at a time — sign up for more.` },
        { status: 400 }
      );
    }

    const ip = getClientIp(req);
    const today = new Date().toISOString().slice(0, 10);

    const { data: existing } = await supabaseAdmin
      .from("guest_usage")
      .select("count")
      .eq("ip_address", ip)
      .eq("usage_date", today)
      .maybeSingle();

    const usedToday = existing?.count || 0;
    const remaining = GUEST_DAILY_LIMIT - usedToday;

    if (remaining <= 0) {
      return NextResponse.json(
        {
          error:
            "You've used today's free demo limit (10). Sign up for a free account to keep going.",
          signupPrompt: true,
        },
        { status: 402 }
      );
    }

    const leadsToProcess: Lead[] = leads.slice(0, remaining);
    const toneDescription =
      tone === "formal"
        ? "formal and businesslike"
        : tone === "casual"
        ? "casual and conversational"
        : "warm and approachable, but still professional";

    const results: any[] = [];
    for (const lead of leadsToProcess) {
      const capacity = await checkGroqCapacity("free");
      if (!capacity.ok) {
        results.push({ lead, opener: "", email: "", failed: true });
        continue;
      }

      const prompt = `You are helping a sender write a short, genuinely personal cold outreach email.

Sender's product/service: ${productDescription}

Lead:
Name: ${lead.name}
Company: ${lead.company}
Context about them: ${lead.context}

Tone: ${toneDescription}

Write a short email (50-80 words) with one specific opener referencing the context, one sentence on the value/offer, and one natural call to action. Do not invent facts not present in the context. Do not use generic filler like "commitment to innovation". Do not use "Worth a quick chat?" as a closing line.

Return ONLY valid JSON, no markdown, in this exact shape:
{"opener": "...", "email": "..."}`;

      try {
        const parsed = await callGroq(prompt);
        if (!parsed.email) {
          results.push({ lead, opener: "", email: "", failed: true });
        } else {
          results.push({ lead, ...parsed, failed: false });
        }
      } catch {
        results.push({ lead, opener: "", email: "", failed: true });
      }

      if (leadsToProcess.length > 1) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    const successCount = results.filter((r) => !r.failed).length;
    await supabaseAdmin.from("guest_usage").upsert(
      {
        ip_address: ip,
        usage_date: today,
        count: usedToday + successCount,
      },
      { onConflict: "ip_address,usage_date" }
    );

    return NextResponse.json({
      results,
      usedToday: usedToday + successCount,
      limit: GUEST_DAILY_LIMIT,
      skipped: leads.length - leadsToProcess.length,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "Server error: " + err.message },
      { status: 500 }
    );
  }
}