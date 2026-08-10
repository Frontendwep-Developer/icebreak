import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { scrapeWebsite, looksLikeUrl } from "@/lib/scrape";

const FREE_MONTHLY_LIMIT = 10;
const PRO_MONTHLY_LIMIT = 500;

type Lead = {
  name: string;
  company: string;
  context: string; // website snippet, LinkedIn note, anything about them
  email: string;
};

export async function POST(req: NextRequest) {
  try {
    const { email, leads, productDescription, senderName } = await req.json();

    if (!email || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: "email va leads majburiy" },
        { status: 400 }
      );
    }
    if (leads.length > 25) {
      return NextResponse.json(
        { error: "Bir martada eng ko'pi bilan 25 ta lead yuborish mumkin" },
        { status: 400 }
      );
    }

    // 1) Foydalanuvchini topish yoki yaratish
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
        .insert({
          email,
          plan: "free",
          credits_used: 0,
          period: currentPeriod,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;
      user = newUser;
    }

    // 2) Oy almashgan bo'lsa limitni reset qilish
    if (user.period !== currentPeriod) {
      const { data: resetUser, error: resetErr } = await supabaseAdmin
        .from("users")
        .update({ credits_used: 0, period: currentPeriod })
        .eq("email", email)
        .select()
        .single();
      if (resetErr) throw resetErr;
      user = resetUser;
    }

    const limit = user.plan === "pro" ? PRO_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT;
    const remaining = limit - user.credits_used;

    if (remaining <= 0) {
      return NextResponse.json(
        {
          error:
            user.plan === "pro"
              ? "Oylik Pro limitingiz tugadi. Keyingi oy yangilanadi."
              : "Bepul limit tugadi (10/oy). Pro'ga o'ting.",
          upgrade: user.plan !== "pro",
        },
        { status: 402 }
      );
    }

    const leadsToProcess: Lead[] = leads.slice(0, remaining);

    // 3) Har bir lead uchun Anthropic API orqali email yozdirish
    const results = await Promise.all(
      leadsToProcess.map(async (lead) => {
        // Agar "kontekst" maydonida URL bo'lsa, avval o'sha saytni o'qib olamiz
        let context = lead.context;
        if (context && looksLikeUrl(context)) {
          const scraped = await scrapeWebsite(context);
          if (scraped) {
            context = scraped;
          }
        }

        const prompt = `You are helping ${senderName || "a sender"} write a short, genuinely personal cold outreach email.

Sender's product/service: ${productDescription}

Lead:
Name: ${lead.name}
Company: ${lead.company}
Context about them (website note, LinkedIn, recent news, or scraped website content): ${context}

Write:
1. One specific opening line (1 sentence) that proves this wasn't copy-pasted — reference the context above.
2. A short email (under 120 words) that flows from that opener into the offer, ends with a low-friction call to action (e.g. "worth a quick chat?").

Return ONLY valid JSON, no markdown, in this exact shape:
{"opener": "...", "email": "..."}`;

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
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
        console.log("GROQ RAW OUTPUT:", text);

        const cleaned = text.replace(/```json|```/g, "").trim();

        let parsed;
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          // Modelga qo'shimcha matn qo'shib yuborgan bo'lishi mumkin —
          // matn ichidan {...} bo'lagini qidirib topamiz
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

        if (!parsed.email) {
          parsed.email = parsed.opener || cleaned;
        }

        return { lead, ...parsed };
      })
    );

    // 4) Ishlatilgan kreditni yozib qo'yish
    await supabaseAdmin
      .from("users")
      .update({ credits_used: user.credits_used + leadsToProcess.length })
      .eq("email", email);

    return NextResponse.json({
      results,
      creditsUsed: user.credits_used + leadsToProcess.length,
      limit,
      skipped: leads.length - leadsToProcess.length,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "Server xatosi: " + err.message },
      { status: 500 }
    );
  }
}