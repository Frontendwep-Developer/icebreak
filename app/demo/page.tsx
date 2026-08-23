"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";

type ResultItem = { lead: any; opener: string; email: string; failed?: boolean };

export default function DemoPage() {
  const [productDescription, setProductDescription] = useState("");
  const [leadsRaw, setLeadsRaw] = useState("");
  const [tone, setTone] = useState("friendly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  function parseLeads(raw: string) {
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 5)
      .map((line) => {
        const [name, company, context] = line.split(",");
        return {
          name: (name || "").trim(),
          company: (company || "").trim(),
          context: (context || "").trim(),
          email: "",
        };
      });
  }

  async function handleGenerate() {
    setError("");
    if (!productDescription.trim()) {
      setError("Please describe your product or service");
      return;
    }
    const leads = parseLeads(leadsRaw);
    if (leads.length === 0) {
      setError("Please add at least one lead (one per line)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/demo-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads, productDescription, tone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setResults(data.results);
      setUsage({ used: data.usedToday, limit: data.limit });
    } catch (e: any) {
      setError("Network error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string, i: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <main className="min-h-screen bg-frost">
      <Navbar variant="landing" />

      <section className="max-w-2xl mx-auto px-6 pt-12 pb-24">
        <h1 className="font-display text-3xl font-semibold mb-2">
          Try Icebreak — no sign-up needed
        </h1>
        <p className="text-glacier/70 mb-8">
          Paste up to 5 leads (one per line: Name, Company, Context) and see
          what Icebreak writes.{" "}
          {usage && (
            <span className="font-mono text-xs text-mist">
              {usage.used}/{usage.limit} used today
            </span>
          )}
        </p>

        <div className="frosted rounded-2xl p-6 space-y-4">
          <textarea
            placeholder="Your product/service description (e.g. I help small e-commerce brands run Meta ads)"
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            rows={2}
            className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
          />
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
          >
            <option value="friendly">Friendly</option>
            <option value="formal">Formal</option>
            <option value="casual">Casual</option>
          </select>
          <textarea
            placeholder={
              "John Smith, Acme Inc, opening a new office in Austin\nJane Doe, Northwind, launching a new product line"
            }
            value={leadsRaw}
            onChange={(e) => setLeadsRaw(e.target.value)}
            rows={5}
            className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70 font-mono text-sm"
          />
          <p className="text-xs text-mist">Up to 5 leads, 10 free per day.</p>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-thaw text-white font-medium px-6 py-3 rounded-full hover:brightness-105 transition disabled:opacity-50"
          >
            {loading ? "Writing..." : "Generate emails"}
          </button>
        </div>

        {results.length > 0 && (
          <div className="mt-8 space-y-4">
            {results.map((r, i) => (
              <div key={i} className="rounded-2xl p-5 border bg-white border-glacier/10">
                <div className="flex items-start justify-between mb-2 gap-3">
                  <p className="font-mono text-xs text-thaw">
                    {r.lead.name} · {r.lead.company}
                  </p>
                  <button
                    onClick={() => copyToClipboard(r.email, i)}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
                  >
                    {copiedIndex === i ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <p className="text-sm whitespace-pre-wrap text-glacier/90">
                  {r.email || "(couldn't generate this one — try again)"}
                </p>
              </div>
            ))}

            <div className="frosted rounded-2xl p-6 text-center mt-8">
              <p className="font-display text-lg font-semibold mb-2">
                Like what you see?
              </p>
              <p className="text-sm text-glacier/70 mb-4">
                Sign up free for 10 emails/month, CSV upload, and more — no
                card required.
              </p>
              <a
                href="/login?mode=signup"
                className="inline-block bg-thaw text-white font-medium px-6 py-3 rounded-full hover:brightness-105 transition"
              >
                Sign up free →
              </a>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}