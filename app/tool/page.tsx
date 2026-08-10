"use client";

import { useState, useEffect } from "react";

type Lead = { name: string; company: string; context: string; email: string };
type ResultItem = {
  lead: Lead;
  opener: string;
  email: string;
};

const GMAIL_BATCH_SIZE = 10;

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

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(
    null
  );
  const [gmailProgress, setGmailProgress] = useState<{
    sent: number;
    total: number;
    skipped: number;
  } | null>(null);
  const [gmailBatchError, setGmailBatchError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail_connected")) setGmailStatus("connected");
    if (params.get("gmail_error")) setGmailStatus("error");
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
    const header = ["Name", "Company", "Email", "Opener", "Message"];
    const rows = results.map((r) => [
      r.lead.name,
      r.lead.company,
      r.lead.email,
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

  function parseLeads(raw: string): Lead[] {
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
      setError("Please fill in your email, product description, and lead list");
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
        setError(data.error || "Something went wrong");
        setNeedsUpgrade(!!data.upgrade);
        return;
      }
      setResults(data.results);
      setSelected(new Set());
      setUsage({ used: data.creditsUsed, limit: data.limit });
    } catch (e: any) {
      setError("Network error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleUpgrade() {
    if (!email) {
      setError("Please enter your email first");
      return;
    }
    const baseUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL;
    const url = `${baseUrl}?checkout[email]=${encodeURIComponent(
      email
    )}&checkout[custom][user_email]=${encodeURIComponent(email)}`;
    window.location.href = url;
  }

  function handleConnectGmail() {
    if (!email) {
      setError("Please enter your email first");
      return;
    }
    window.location.href = `/api/auth/google?email=${encodeURIComponent(email)}`;
  }

  // --- Selection helpers ---

  function toggleSelect(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((_, i) => i)));
    }
  }

  // --- Clear / delete ---

  function clearAll() {
    setResults([]);
    setSelected(new Set());
    setEditingIndex(null);
    setGmailProgress(null);
    setGmailBatchError("");
  }

  function deleteSelected() {
    setResults((prev) => prev.filter((_, i) => !selected.has(i)));
    setSelected(new Set());
  }

  // --- Edit ---

  function startEdit(i: number) {
    setEditingIndex(i);
    setEditText(results[i].email);
  }

  function saveEdit(i: number) {
    setResults((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, email: editText } : r))
    );
    setEditingIndex(null);
  }

  function cancelEdit() {
    setEditingIndex(null);
  }

  function clearEditText() {
    setEditText("");
  }

  // --- Regenerate single result ---

  async function regenerate(i: number) {
    setRegeneratingIndex(i);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          senderName,
          productDescription,
          leads: [results[i].lead],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not regenerate");
        setNeedsUpgrade(!!data.upgrade);
        return;
      }
      const newResult = data.results[0];
      setResults((prev) =>
        prev.map((r, idx) => (idx === i ? newResult : r))
      );
      setUsage({ used: data.creditsUsed, limit: data.limit });
    } catch (e: any) {
      setError("Network error: " + e.message);
    } finally {
      setRegeneratingIndex(null);
    }
  }

  // --- Gmail batch send ---

  async function sendToGmail() {
    const indices =
      selected.size > 0 ? Array.from(selected) : results.map((_, i) => i);

    const withContent = indices.filter((i) => results[i].email.trim());
    const emptyCount = indices.length - withContent.length;
    const toSend = withContent.map((i) => results[i]);

    if (toSend.length === 0) {
      setGmailBatchError("All selected results are empty — nothing to send.");
      return;
    }

    setGmailBatchError("");
    setGmailProgress({ sent: 0, total: toSend.length, skipped: emptyCount });

    for (let i = 0; i < toSend.length; i += GMAIL_BATCH_SIZE) {
      const batch = toSend.slice(i, i + GMAIL_BATCH_SIZE);
      try {
        const res = await fetch("/api/gmail/create-drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, results: batch }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.needsConnect) setGmailStatus("idle");
          setGmailBatchError(data.error || "Could not save some drafts");
          break;
        }
        setGmailProgress((prev) =>
          prev ? { ...prev, sent: Math.min(i + batch.length, toSend.length) } : null
        );
      } catch (e: any) {
        setGmailBatchError("Network error: " + e.message);
        break;
      }
      // brief pause between batches to stay well under Gmail's rate limits
      if (i + GMAIL_BATCH_SIZE < toSend.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
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
              {usage.used} / {usage.limit} used
            </span>
          )}
          <button
            onClick={handleUpgrade}
            className="text-sm font-medium px-4 py-2 rounded-full border border-thaw text-thaw hover:bg-thaw hover:text-white transition-colors"
          >
            Upgrade to Pro
          </button>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-6 pb-24">
        <h1 className="font-display text-3xl font-semibold mb-2">
          Generate your emails
        </h1>
        <p className="text-glacier/70 mb-8">
          One lead per line:{" "}
          <span className="font-mono text-sm">Name, Company, Context, Email</span>
        </p>

        {gmailStatus === "connected" && (
          <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            ✓ Your Gmail account is connected.
          </div>
        )}
        {gmailStatus === "error" && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            Something went wrong connecting Gmail. Please try again.
          </div>
        )}

        <div className="frosted rounded-2xl p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
            />
            <input
              type="text"
              placeholder="Your name (for the email sign-off)"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
            />
          </div>
          <textarea
            placeholder="Your product/service description (e.g. I help small e-commerce brands run Meta ads)"
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            rows={2}
            className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
          />
          <p className="text-xs text-mist -mt-2">
            💡 Instead of typing context, you can paste a company website
            (e.g. <span className="font-mono">acme.com</span>) and Icebreak
            will read it for you.
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
                  Upgrade to Pro →
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="bg-thaw text-white font-medium px-6 py-3 rounded-full hover:brightness-105 transition disabled:opacity-50"
            >
              {loading ? "Writing..." : "Generate emails"}
            </button>
            <button
              onClick={handleConnectGmail}
              className="text-sm font-medium px-4 py-2.5 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
            >
              {gmailStatus === "connected"
                ? "Gmail connected ✓"
                : "Connect Gmail"}
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="mt-10 space-y-5">
            <div className="sticky top-4 z-10 bg-frost/95 backdrop-blur-sm rounded-2xl border border-glacier/10 px-4 py-3 flex items-center justify-between mb-2 flex-wrap gap-3 shadow-sm">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="font-display text-xl font-semibold">
                  Results
                </h2>
                <span className="text-xs text-mist font-mono">
                  {results.length} total ·{" "}
                  {results.filter((r) => !r.email.trim()).length} empty
                </span>
                <label className="flex items-center gap-1.5 text-xs text-mist cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      selected.size === results.length && results.length > 0
                    }
                    onChange={toggleSelectAll}
                  />
                  Select all
                </label>
                {selected.size > 0 && (
                  <span className="text-xs text-mist">
                    {selected.size} selected
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {selected.size > 0 && (
                  <button
                    onClick={deleteSelected}
                    className="text-sm font-medium px-4 py-2 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Delete selected
                  </button>
                )}
                <button
                  onClick={downloadCsv}
                  className="text-sm font-medium px-4 py-2 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
                >
                  Download CSV
                </button>
                <button
                  onClick={sendToGmail}
                  disabled={!!gmailProgress && gmailProgress.sent < gmailProgress.total}
                  className="text-sm font-medium px-4 py-2 rounded-full bg-glacier text-frost hover:brightness-110 transition disabled:opacity-50"
                >
                  {selected.size > 0
                    ? `Send ${selected.size} selected to Gmail`
                    : "Send all to Gmail"}
                </button>
                <button
                  onClick={clearAll}
                  className="text-sm font-medium px-4 py-2 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
                >
                  Clear results
                </button>
              </div>
            </div>

            {gmailProgress && (
              <div className="text-sm text-glacier/70 bg-white/70 border border-glacier/10 rounded-xl px-4 py-2">
                {gmailBatchError ? (
                  <span className="text-red-600">{gmailBatchError}</span>
                ) : gmailProgress.sent === gmailProgress.total ? (
                  <>
                    ✓ Saved {gmailProgress.total} drafts to Gmail.
                    {gmailProgress.skipped > 0 &&
                      ` (${gmailProgress.skipped} empty result${
                        gmailProgress.skipped > 1 ? "s" : ""
                      } skipped)`}
                  </>
                ) : (
                  `Saving to Gmail: ${gmailProgress.sent} / ${gmailProgress.total}...`
                )}
              </div>
            )}

            {results.map((r, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-5 border border-glacier/10"
              >
                <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(i)}
                      onChange={() => toggleSelect(i)}
                    />
                    <div>
                      <p className="font-mono text-xs text-thaw">
                        {r.lead.name} · {r.lead.company}
                      </p>
                      <p className="font-mono text-[11px] text-mist">
                        {r.lead.email || "no email provided"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => copyToClipboard(r.email, i)}
                      className="text-xs font-medium px-3 py-1.5 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
                    >
                      {copiedIndex === i ? "Copied ✓" : "Copy"}
                    </button>
                    <a
                      href={buildMailtoLink(r)}
                      className="text-xs font-medium px-3 py-1.5 rounded-full bg-thaw text-white hover:brightness-105 transition"
                    >
                      Open in email
                    </a>
                    <button
                      onClick={() => startEdit(i)}
                      className="text-xs font-medium px-3 py-1.5 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => regenerate(i)}
                      disabled={regeneratingIndex === i}
                      className="text-xs font-medium px-3 py-1.5 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors disabled:opacity-50"
                    >
                      {regeneratingIndex === i ? "Regenerating..." : "Regenerate"}
                    </button>
                  </div>
                </div>

                {editingIndex === i ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={5}
                      className="w-full border border-glacier/15 rounded-xl px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(i)}
                        className="text-xs font-medium px-3 py-1.5 rounded-full bg-thaw text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-xs font-medium px-3 py-1.5 rounded-full border border-glacier/15"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={clearEditText}
                        className="text-xs font-medium px-3 py-1.5 rounded-full border border-glacier/15 hover:border-red-300 hover:text-red-500 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm italic text-glacier/80 mb-2">
                      {r.opener}
                    </p>
                    <p className="text-sm whitespace-pre-wrap text-glacier/90">
                      {r.email}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}