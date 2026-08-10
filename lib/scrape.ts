// Oddiy, tashqi kutubxonasiz HTML'dan matn ajratib oluvchi yordamchi.
// Maqsad — sahifaning "About / hero" qismidagi asosiy matnni topish,
// murakkab sahifa tuzilishini emas.

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string, name: string): string {
  const regex = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const match = html.match(regex);
  return match ? match[1] : "";
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "";
}

export async function scrapeWebsite(url: string): Promise<string> {
  try {
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(fullUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; IcebreakBot/1.0; +https://icebreak.app)",
      },
      // 8 soniyadan ortiq kutmaymiz — sekin saytlar butun so'rovni sekinlashtirmasin
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return "";

    const html = await res.text();

    const title = extractTitle(html);
    const description =
      extractMeta(html, "description") ||
      extractMeta(html, "og:description");

    // Sahifa matnining birinchi ~1200 belgisini ham qo'shamiz —
    // ko'p saytlarda hero/intro matni shu joyda bo'ladi
    const bodyText = stripTags(html).slice(0, 1200);

    const combined = [title, description, bodyText]
      .filter(Boolean)
      .join(". ")
      .slice(0, 1500);

    return combined;
  } catch (err) {
    console.error("Scrape error for", url, err);
    return "";
  }
}

export function looksLikeUrl(text: string): boolean {
  return /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/\S*)?$/i.test(text.trim());
}
