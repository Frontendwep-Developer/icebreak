// A small, dependency-free HTML-to-text helper.
// Goal: pull out the "About / hero" style copy from a page,
// not parse the full page structure.

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

function extractHeadings(html: string): string {
  const matches = [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)];
  return matches
    .map((m) => stripTags(m[1]))
    .filter(Boolean)
    .slice(0, 3)
    .join(". ");
}

export async function scrapeWebsite(url: string): Promise<string> {
  try {
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(fullUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; IcebreakBot/1.0; +https://icebreak.app)",
      },
      // Don't wait more than 8 seconds — a slow site shouldn't slow down the whole request
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return "";

    const html = await res.text();

    const title = extractTitle(html);
    const headings = extractHeadings(html);
    const description =
      extractMeta(html, "description") ||
      extractMeta(html, "og:description");

    // Also grab the first ~1200 characters of body text —
    // most sites put hero/intro copy right there
    const bodyText = stripTags(html).slice(0, 1200);

    const combined = [title, headings, description, bodyText]
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