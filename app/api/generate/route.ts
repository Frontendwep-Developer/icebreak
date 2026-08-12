import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { scrapeWebsite, looksLikeUrl } from "@/lib/scrape";
import { checkGroqCapacity } from "@/lib/rateGuard";

// Sequential Groq calls (to respect rate limits) can take a while for large
// batches, so we raise the max execution time for this route.
export const maxDuration = 60;

const FREE_MONTHLY_LIMIT = 10;
const PRO_MONTHLY_LIMIT = 500;
// "Bring your own template" mode doesn't call the AI at all, so it's kept
// free for everyone — this cap exists only to prevent abuse, not as a paid perk.
const TEMPLATE_MONTHLY_LIMIT = 200;

type Lead = {
  name: string;
  company: string;
  context: string;
  email: string;
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  friendly: "warm and approachable, but still professional",
  formal: "formal and businesslike, no slang or casual phrasing",
  short: "extremely brief and to the point — no filler at all",
  casual: "casual and conversational, like messaging a peer",
};

async function callGroq(prompt: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "{}";
  const cleaned = text.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = { opener: "", email: cleaned };
      }
    } else {
      parsed = { opener: "", email: cleaned };
    }
  }

  if (!parsed.email) parsed.email = parsed.opener || cleaned;
  return parsed;
}

function fillTemplate(text: string, lead: Lead) {
  return text
    .replace(/\{name\}/gi, lead.name || "there")
    .replace(/\{company\}/gi, lead.company || "your company");
}

export async function POST(req: NextRequest) {
  try {
    const {
      email,
      leads,
      productDescription,
      senderName,
      tone,
      language,
      sameForAll,
      ownTemplate,
    } = await req.json();

    if (!email || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: "email and leads are required" },
        { status: 400 }
      );
    }
    if (leads.length > 25) {
      return NextResponse.json(
        { error: "You can send at most 25 leads at once" },
        { status: 400 }
      );
    }

    let { data: user } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${now.getMonth() + 1}`;

    if (!user) {
      const { data: newUser, error: insertErr } = await supabaseAdmin
        .from("users")
        .insert({ email, plan: "free", credits_used: 0, period: currentPeriod })
        .select()
        .single();
      if (insertErr) throw insertErr;
      user = newUser;
    }

    if (user.period !== currentPeriod) {
      const { data: resetUser, error: resetErr } = await supabaseAdmin
        .from("users")
        .update({ credits_used: 0, template_credits_used: 0, period: currentPeriod })
        .eq("email", email)
        .select()
        .single();
      if (resetErr) throw resetErr;
      user = resetUser;
    }

    // --- Mode 0: user brings their own template — no AI call, free for everyone ---
    if (ownTemplate && ownTemplate.trim()) {
      const templateUsed = user.template_credits_used || 0;
      const templateRemaining = TEMPLATE_MONTHLY_LIMIT - templateUsed;

      if (templateRemaining <= 0) {
        return NextResponse.json(
          {
            error:
              "You've used your monthly template-sending limit (200). It resets next month.",
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

      const newTemplateUsed = templateUsed + leadsToFill.length;
      await supabaseAdmin
        .from("users")
        .update({ template_credits_used: newTemplateUsed })
        .eq("email", email);

      return NextResponse.json({
        results,
        templateCreditsUsed: newTemplateUsed,
        templateLimit: TEMPLATE_MONTHLY_LIMIT,
        creditsUsed: user.credits_used,
        limit: user.plan === "pro" ? PRO_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT,
        skipped: leads.length - leadsToFill.length,
        failed: 0,
      });
    }

    const limit = user.plan === "pro" ? PRO_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT;
    const remaining = limit - user.credits_used;

    if (remaining <= 0) {
      return NextResponse.json(
        {
          error:
            user.plan === "pro"
              ? "You've hit your monthly Pro limit. It resets next month."
              : "You've used your free monthly limit (10). Upgrade to Pro for more.",
          upgrade: user.plan !== "pro",
        },
        { status: 402 }
      );
    }

    const toneDescription = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.friendly;
    const outputLanguage = language || "English";

    // --- Mode 1: one shared message for every lead (costs 1 credit total) ---
    if (sameForAll) {
      const capacity = await checkGroqCapacity(user.plan);
      if (!capacity.ok) {
        return NextResponse.json(
          {
            error:
              capacity.reason === "day"
                ? "We've hit today's free AI capacity. Please try again tomorrow, or upgrade to Pro for uninterrupted access. (We're in early testing — thanks for your patience while we grow!)"
                : "A lot of people are generating right now. Please wait about a minute and try again, or upgrade to Pro to skip the queue.",
            upgrade: true,
          },
          { status: 503 }
        );
      }

      try {
        const prompt = `You are helping ${senderName || "a sender"} write a short cold outreach email template that will be sent to multiple leads.

Sender's product/service: ${productDescription}

Tone: ${toneDescription}
Write the entire output in ${outputLanguage}.

Use {name} as a placeholder for the recipient's first name and {company} as a placeholder for their company name — these will be substituted automatically for each recipient. Do not write a specific company or person; keep it generic enough to work for anyone, while still using {name} and {company} naturally.

Write:
1. One opening line (1 sentence) using {name} and/or {company}.
2. A short email (under 120 words) that flows from that opener into the offer, ends with a low-friction call to action (e.g. "worth a quick chat?").

Return ONLY valid JSON, no markdown, in this exact shape:
{"opener": "...", "email": "..."}`;

        const parsed = await callGroq(prompt);

        if (!parsed.email) {
          return NextResponse.json(
            { error: "The AI didn't return a usable message. Please try again." },
            { status: 500 }
          );
        }

        const results = leads.map((lead: Lead) => ({
          lead,
          opener: fillTemplate(parsed.opener, lead),
          email: fillTemplate(parsed.email, lead),
          failed: false,
        }));

        const newCreditsUsed = user.credits_used + 1;
        await supabaseAdmin
          .from("users")
          .update({ credits_used: newCreditsUsed })
          .eq("email", email);

        return NextResponse.json({
          results,
          creditsUsed: newCreditsUsed,
          limit,
          skipped: 0,
          failed: 0,
        });
      } catch (err: any) {
        console.error("sameForAll generation failed:", err);
        return NextResponse.json(
          { error: "Could not generate the shared message. Please try again." },
          { status: 500 }
        );
      }
    }

    // --- Mode 2: personalized per lead (default, costs 1 credit per successful lead) ---
    const leadsToProcess: Lead[] = leads.slice(0, remaining);

    // Process leads sequentially (not in parallel) with a short delay between
    // calls, to stay well under Groq's shared rate limit (30 requests/minute
    // on the free tier). Firing them all at once risks 429 errors as soon as
    // more than a couple of users generate at the same time.
    const results: any[] = [];
    let capacityHit: "day" | "minute" | null = null;

    for (const lead of leadsToProcess) {
      const capacity = await checkGroqCapacity(user.plan);
      if (!capacity.ok) {
        capacityHit = capacity.reason;
        break;
      }

      try {
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
Context about them (website note, LinkedIn, recent news, or scraped website content): ${context}

Tone: ${toneDescription}
Write the entire output in ${outputLanguage}.

Write:
1. One specific opening line (1 sentence) that proves this wasn't copy-pasted — reference the context above.
2. A short email (under 120 words) that flows from that opener into the offer, ends with a low-friction call to action (e.g. "worth a quick chat?").

Return ONLY valid JSON, no markdown, in this exact shape:
{"opener": "...", "email": "..."}`;

        const parsed = await callGroq(prompt);
        if (!parsed.email) {
          results.push({ lead, opener: "", email: "", failed: true });
        } else {
          results.push({ lead, ...parsed, failed: false });
        }
      } catch (err) {
        console.error("Lead generation failed for", lead.name, err);
        results.push({ lead, opener: "", email: "", failed: true });
      }

      // Small pause between requests so a single batch never bursts past
      // the shared rate limit on its own.
      if (leadsToProcess.length > 1) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    // Only charge credits for leads that actually produced a result
    const successCount = results.filter((r) => !r.failed).length;
    const newCreditsUsed = user.credits_used + successCount;
    await supabaseAdmin
      .from("users")
      .update({ credits_used: newCreditsUsed })
      .eq("email", email);

    return NextResponse.json({
      results,
      creditsUsed: newCreditsUsed,
      limit,
      skipped: leads.length - leadsToProcess.length,
      failed: leadsToProcess.length - successCount,
      capacityMessage:
        capacityHit === "day"
          ? "We've hit today's free AI capacity partway through this batch — the rest are shown as empty. Please try again tomorrow, or upgrade to Pro for uninterrupted access."
          : capacityHit === "minute"
          ? "A lot of people are generating right now, so we paused partway through this batch — the rest are shown as empty. Wait about a minute and use Edit → Regenerate on them, or upgrade to Pro to skip the queue."
          : null,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "Server error: " + err.message },
      { status: 500 }
    );
  }
}