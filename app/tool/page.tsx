"use client";

import { useState, useEffect } from "react";

type ResultItem = {
  lead: { name: string; company: string; context: string; email: string };
  opener: string;
  email: string;
};

export default function ToolPage() {
  const [email, setEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [leadsRaw, setLeadsRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(
    null
  );
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [gmailStatus, setGmailStatus] = useState<
    "idle" | "connected" | "error"
  >("idle");
  const [draftsStatus, setDraftsStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail_connected")) {
      setGmailStatus("connected");
    }
    if (params.get("gmail_error")) {
      setGmailStatus("error");
    }
  }, []);

  function copyToClipboard(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  function buildMailtoLink(r: ResultItem) {
    const subject = encodeURIComponent(`Quick question, ${r.lead.name}`);
    const body = encodeURIComponent(r.email);
    return `mailto:${r.lead.email || ""}?subject=${subject}&body=${body}`;
  }

  function downloadCsv() {
    if (results.length === 0) return;
    const escapeCsv = (value: string) =>
      `"${(value || "").replace(/"/g, '""')}"`;
    const header = ["Name", "Company", "Opener", "Email"];
    const rows = results.map((r) => [
      r.lead.name,
      r.lead.company,
      r.opener,
      r.email,
    ]);
    const csvContent = [header, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "icebreak-emails.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function parseLeads(raw: string) {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, company, context, leadEmail] = line.split(",");
        return {
          name: (name || "").trim(),
          company: (company || "").trim(),
          context: (context || "").trim(),
          email: (leadEmail || "").trim(),
        };
      });
  }

  async function handleGenerate() {
    setError("");
    setNeedsUpgrade(false);
    if (!email || !productDescription || !leadsRaw) {
      setError("Email, mahsulot tavsifi va leadlar ro'yxatini to'ldiring");
      return;
    }
    const leads = parseLeads(leadsRaw);
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senderName, productDescription, leads }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Xatolik yuz berdi");
        setNeedsUpgrade(!!data.upgrade);
        return;
      }
      setResults(data.results);
      setUsage({ used: data.creditsUsed, limit: data.limit });
    } catch (e: any) {
      setError("Tarmoq xatosi: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade() {
    if (!email) {
      setError("Avval emailingizni kiriting");
      return;
    }
    const res = await fetch("/api/lemonsqueezy/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  function handleConnectGmail() {
    if (!email) {
      setError("Avval emailingizni kiriting");
      return;
    }
    window.location.href = `/api/auth/google?email=${encodeURIComponent(email)}`;
  }

  async function handleCreateDrafts() {
    setDraftsStatus("loading");
    try {
      const res = await fetch("/api/gmail/create-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, results }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsConnect) {
          setGmailStatus("idle");
        }
        setError(data.error || "Draft yaratib bo'lmadi");
        setDraftsStatus("error");
        return;
      }
      setDraftsStatus("done");
    } catch (e: any) {
      setError("Tarmoq xatosi: " + e.message);
      setDraftsStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-frost">
      <nav className="max-w-4xl mx-auto flex items-center justify-between px-6 py-6">
        <a href="/" className="font-display font-semibold text-lg">
          ice<span className="text-thaw">break</span>
        </a>
        <div className="flex items-center gap-4">
          {usage && (
            <span className="font-mono text-xs text-mist">
              {usage.used} / {usage.limit} ishlatildi
            </span>
          )}
          <button
            onClick={handleUpgrade}
            className="text-sm font-medium px-4 py-2 rounded-full border border-thaw text-thaw hover:bg-thaw hover:text-white transition-colors"
          >
            Pro&apos;ga o&apos;tish
          </button>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-6 pb-24">
        <h1 className="font-display text-3xl font-semibold mb-2">
          Emaillaringizni generatsiya qiling
        </h1>
        <p className="text-glacier/70 mb-8">
          Har bir qatorga bitta lead:{" "}
          <span className="font-mono text-sm">Ism, Kompaniya, Kontekst</span>
        </p>

        {gmailStatus === "connected" && (
          <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            ✓ Gmail hisobingiz muvaffaqiyatli ulandi.
          </div>
        )}
        {gmailStatus === "error" && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            Gmail ulashda xatolik yuz berdi. Qayta urinib ko&apos;ring.
          </div>
        )}

        <div className="frosted rounded-2xl p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="email"
              placeholder="Sizning emailingiz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
            />
            <input
              type="text"
              placeholder="Ismingiz (email imzosi uchun)"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
            />
          </div>
          <textarea
            placeholder="Mahsulot/xizmatingiz tavsifi (masalan: Men kichik e-commerce brendlarga Meta ads boshqarib beraman)"
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            rows={2}
            className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
          />
          <p className="text-xs text-mist -mt-2">
            💡 Kontekst o&apos;rniga to&apos;g&apos;ridan-to&apos;g&apos;ri
            kompaniya veb-saytini (masalan{" "}
            <span className="font-mono">acme.com</span>) yozsangiz, Icebreak
            saytni o&apos;zi o&apos;qib, shundan kelib chiqib yozadi.
          </p>
          <textarea
            placeholder={
              "John Smith, Acme Inc, acme.com, john@acme.com\nJane Doe, Northwind, website mentions launching in EU next month, jane@northwind.com"
            }
            value={leadsRaw}
            onChange={(e) => setLeadsRaw(e.target.value)}
            rows={6}
            className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70 font-mono text-sm"
          />

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
              {needsUpgrade && (
                <button
                  onClick={handleUpgrade}
                  className="ml-3 underline font-medium"
                >
                  Pro&apos;ga o&apos;tish →
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="bg-thaw text-white font-medium px-6 py-3 rounded-full hover:brightness-105 transition disabled:opacity-50"
            >
              {loading ? "Yozilmoqda..." : "Emaillarni generatsiya qilish"}
            </button>
            <button
              onClick={handleConnectGmail}
              className="text-sm font-medium px-4 py-2.5 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
            >
              {gmailStatus === "connected"
                ? "Gmail ulandi ✓"
                : "Gmail hisobini ulash"}
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="mt-10 space-y-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="font-display text-xl font-semibold">
                Natijalar
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={downloadCsv}
                  className="text-sm font-medium px-4 py-2 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
                >
                  CSV yuklab olish
                </button>
                <button
                  onClick={handleCreateDrafts}
                  disabled={draftsStatus === "loading"}
                  className="text-sm font-medium px-4 py-2 rounded-full bg-glacier text-frost hover:brightness-110 transition disabled:opacity-50"
                >
                  {draftsStatus === "loading"
                    ? "Joylanmoqda..."
                    : draftsStatus === "done"
                    ? "Gmail'ga joylandi ✓"
                    : "Barchasini Gmail draftga joylash"}
                </button>
              </div>
            </div>
            {results.map((r, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-5 border border-glacier/10"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-mono text-xs text-thaw">
                    {r.lead.name} · {r.lead.company}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(r.email, i)}
                      className="text-xs font-medium px-3 py-1.5 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
                    >
                      {copiedIndex === i ? "Nusxalandi ✓" : "Nusxalash"}
                    </button>
                    <a
                      href={buildMailtoLink(r)}
                      className="text-xs font-medium px-3 py-1.5 rounded-full bg-thaw text-white hover:brightness-105 transition"
                    >
                      Emailda ochish
                    </a>
                  </div>
                </div>
                <p className="text-sm italic text-glacier/80 mb-2">
                  {r.opener}
                </p>
                <p className="text-sm whitespace-pre-wrap text-glacier/90">
                  {r.email}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}