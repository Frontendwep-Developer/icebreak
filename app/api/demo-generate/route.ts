import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { scrapeWebsite, looksLikeUrl } from "@/lib/scrape";
import { checkGroqCapacity } from "@/lib/rateGuard";

export const maxDuration = 60;

const GUEST_DAILY_LIMIT = 10;
const GUEST_TEMPLATE_DAILY_LIMIT = 20; // own-template mode, lighter cap for guests
const MAX_LEADS_PER_REQUEST = 25;

type Lead = { name: string; company: string; context: string; email: string };

const TONE_INSTRUCTIONS: Record<string, string> = {
  friendly: "warm and approachable, but still professional",
  formal: "formal and businesslike, no slang or casual phrasing",
  short: "extremely brief and to the point — no filler at all",
  casual: "casual and conversational, like messaging a peer",
};

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

function fillTemplate(text: string, lead: Lead) {
  return text
    .replace(/\{name\}/gi, lead.name || "there")
    .replace(/\{company\}/gi, lead.company || "your company");
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
    const { leads, productDescription, senderName, tone, language, sameForAll, ownTemplate } =
      await req.json();

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: "leads are required" }, { status: 400 });
    }
    if (leads.length > MAX_LEADS_PER_REQUEST) {
      return NextResponse.json(
        { error: `You can send at most ${MAX_LEADS_PER_REQUEST} leads at once` },
        { status: 400 }
      );
    }

    const ip = getClientIp(req);
    const today = new Date().toISOString().slice(0, 10);

    const { data: existing } = await supabaseAdmin
      .from("guest_usage")
      .select("count, template_count")
      .eq("ip_address", ip)
      .eq("usage_date", today)
      .maybeSingle();

    const usedToday = existing?.count || 0;
    const templateUsedToday = existing?.template_count || 0;

    // --- Mode 0: own template — no AI, lighter separate cap ---
    if (ownTemplate && ownTemplate.trim()) {
      const templateRemaining = GUEST_TEMPLATE_DAILY_LIMIT - templateUsedToday;
      if (templateRemaining <= 0) {
        return NextResponse.json(
          {
            error: "You've used today's free template limit. Sign up for a free account to keep going.",
            signupPrompt: true,
          },
          { status: 402 }
        );
      }
      const leadsToFill: Lead[] = leads.slice(0, templateRemaining);
      const results = leadsToFill.map((lead) => ({
        lead,
        opener: "",
        email: fillTemplate(ownTemplate, lead),
        failed: false,
      }));

      await supabaseAdmin.from("guest_usage").upsert(
        {
          ip_address: ip,
          usage_date: today,
          count: usedToday,
          template_count: templateUsedToday + leadsToFill.length,
        },
        { onConflict: "ip_address,usage_date" }
      );

      return NextResponse.json({
        results,
        usedToday,
        limit: GUEST_DAILY_LIMIT,
        templateUsedToday: templateUsedToday + leadsToFill.length,
        templateLimit: GUEST_TEMPLATE_DAILY_LIMIT,
        skipped: leads.length - leadsToFill.length,
      });
    }

    const remaining = GUEST_DAILY_LIMIT - usedToday;
    if (remaining <= 0) {
      return NextResponse.json(
        {
          error: "You've used today's free demo limit (10). Sign up for a free account to keep going.",
          signupPrompt: true,
        },
        { status: 402 }
      );
    }

    const toneDescription = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.friendly;
    const outputLanguage = language || "English";

    // --- Mode 1: same message for all (1 credit total) ---
    if (sameForAll) {
      const capacity = await checkGroqCapacity("free");
      if (!capacity.ok) {
        return NextResponse.json(
          { error: "A lot of people are trying the demo right now — try again in a minute.", upgrade: true },
          { status: 503 }
        );
      }
      const prompt = `You are helping ${senderName || "a sender"} write a short cold outreach email template for multiple leads.

Sender's product/service: ${productDescription}
Tone: ${toneDescription}
Write in ${outputLanguage} only.

Use {name} and {company} as placeholders — they'll be filled in automatically. Keep it generic enough to work for anyone.

Write a short email (50-80 words, or 30-50 if tone is "short") with one opener sentence, one value sentence, and one natural call to action. No generic filler, no "Worth a quick chat?" closing.

Return ONLY valid JSON: {"opener": "...", "email": "..."}`;

      const parsed = await callGroq(prompt);
      if (!parsed.email) {
        return NextResponse.json({ error: "Could not generate — please try again." }, { status: 500 });
      }
      const results = leads.map((lead: Lead) => ({
        lead,
        opener: fillTemplate(parsed.opener || "", lead),
        email: fillTemplate(parsed.email, lead),
        failed: false,
      }));

      await supabaseAdmin.from("guest_usage").upsert(
        { ip_address: ip, usage_date: today, count: usedToday + 1, template_count: templateUsedToday },
        { onConflict: "ip_address,usage_date" }
      );

      return NextResponse.json({
        results,
        usedToday: usedToday + 1,
        limit: GUEST_DAILY_LIMIT,
        skipped: 0,
      });
    }

    // --- Mode 2: personalized per lead ---
    const leadsToProcess: Lead[] = leads.slice(0, remaining);
    const results: any[] = [];

    for (const lead of leadsToProcess) {
      const capacity = await checkGroqCapacity("free");
      if (!capacity.ok) break;

      let context = lead.context;
      if (context && looksLikeUrl(context)) {
        const scraped = await scrapeWebsite(context);
        if (scraped) context = scraped;
      }

      const prompt = `You are helping ${senderName || "a sender"} write a short, genuinely personal cold outreach email.

Sender's product/service: ${productDescription}

Lead:
Name: ${lead.name}
Company: ${lead.company}
Context about them: ${context}

Tone: ${toneDescription}
Write in ${outputLanguage} only.

Write a short email (50-80 words, or 30-50 if tone is "short") with one specific opener referencing the context, one value sentence, one natural call to action. Only reference facts literally present in the context — never invent details. No generic filler, no "Worth a quick chat?" closing.

Return ONLY valid JSON: {"opener": "...", "email": "..."}`;

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
        template_count: templateUsedToday,
      },
      { onConflict: "ip_address,usage_date" }
    );

    return NextResponse.json({
      results,
      usedToday: usedToday + successCount,
      limit: GUEST_DAILY_LIMIT,
      skipped: leads.length - leadsToProcess.length,
      failed: leadsToProcess.length - successCount,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: "Server error: " + err.message }, { status: 500 });
  }
}