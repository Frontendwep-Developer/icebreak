"use client";

import { useState } from "react";
import Papa from "papaparse";
import Navbar from "@/components/Navbar";

type Lead = { name: string; company: string; context: string; email: string };
type ResultItem = { lead: Lead; opener: string; email: string; failed?: boolean };
type CsvMapping = { name: string; company: string; context: string; email: string };

const MAX_LEADS = 25;

export default function DemoPage() {
  const [senderName, setSenderName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [tone, setTone] = useState("friendly");
  const [language, setLanguage] = useState("English");
  const [mode, setMode] = useState<"personalized" | "sameForAll" | "ownTemplate">("personalized");
  const [ownTemplateText, setOwnTemplateText] = useState("");
  const [leadsRaw, setLeadsRaw] = useState("");
  const [leadInputMode, setLeadInputMode] = useState<"paste" | "csv">("paste");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvMapping, setCsvMapping] = useState<CsvMapping>({ name: "", company: "", context: "", email: "" });
  const [csvFileName, setCsvFileName] = useState("");
  const [csvError, setCsvError] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsSignup, setNeedsSignup] = useState(false);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  function parseLeads(raw: string): Lead[] {
    return raw
      .split("\n")
      .map((l) => l.trim())
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

  function guessMapping(headers: string[]): CsvMapping {
    const find = (keywords: string[]) =>
      headers.find((h) => keywords.some((k) => h.toLowerCase().includes(k))) || "";
    return {
      name: find(["name", "full name", "first"]),
      company: find(["company", "organization", "org"]),
      email: find(["email", "e-mail"]),
      context: find(["context", "note", "website", "about", "linkedin"]),
    };
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError("");
    setCsvFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const fields = (res.meta.fields || []).filter(Boolean);
        if (fields.length === 0) {
          setCsvError("Couldn't read any columns from this file.");
          return;
        }
        const rows = res.data as Record<string, string>[];
        setCsvHeaders(fields);
        setCsvRows(rows.slice(0, MAX_LEADS));
        setCsvMapping(guessMapping(fields));
        if (rows.length > MAX_LEADS) {
          setCsvError(`This file has ${rows.length} rows — only the first ${MAX_LEADS} will be used.`);
        }
      },
      error: (err) => setCsvError("Couldn't parse this file: " + err.message),
    });
  }

  function buildLeadsFromCsv(): Lead[] {
    return csvRows.map((row) => ({
      name: csvMapping.name ? (row[csvMapping.name] || "").trim() : "",
      company: csvMapping.company ? (row[csvMapping.company] || "").trim() : "",
      context: csvMapping.context ? (row[csvMapping.context] || "").trim() : "",
      email: csvMapping.email ? (row[csvMapping.email] || "").trim() : "",
    }));
  }

  async function handleGenerate() {
    setError("");
    setNeedsSignup(false);

    if (leadInputMode === "paste" && !leadsRaw) {
      setError("Please fill in your lead list");
      return;
    }
    if (leadInputMode === "csv" && csvRows.length === 0) {
      setError("Please upload a CSV file first");
      return;
    }
    if (leadInputMode === "csv" && (!csvMapping.name || !csvMapping.email)) {
      setError("Please map at least the Name and Email columns");
      return;
    }
    if (mode === "ownTemplate" && !ownTemplateText.trim()) {
      setError("Please paste your template message");
      return;
    }
    if (mode !== "ownTemplate" && !productDescription) {
      setError("Please fill in your product description");
      return;
    }

    const leads = leadInputMode === "csv" ? buildLeadsFromCsv() : parseLeads(leadsRaw);
    setLoading(true);
    try {
      const res = await fetch("/api/demo-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName,
          productDescription,
          tone,
          language,
          sameForAll: mode === "sameForAll",
          ownTemplate: mode === "ownTemplate" ? ownTemplateText : undefined,
          leads,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setNeedsSignup(!!data.signupPrompt);
        return;
      }
      setResults(data.results);
      setUsage({ used: data.usedToday, limit: data.limit });
      if (data.failed > 0) {
        setError(`${data.failed} lead(s) couldn't be generated — try again or sign up for full access.`);
      }
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
      <Navbar variant="demo" />

      <section className="max-w-3xl mx-auto px-6 pt-12 pb-24">
        <div className="bg-thaw/10 border border-thaw/30 rounded-xl px-4 py-2.5 mb-6 text-sm text-glacier/80">
          🧪 <strong>Demo / test mode</strong> — you're using Icebreak without
          an account. Some buttons (History, Profile, Gmail) will prompt you
          to sign up, since those need a real account.
        </div>
        <h1 className="font-display text-3xl font-semibold mb-2">
          Try Icebreak — no sign-up needed
        </h1>
        <p className="text-glacier/70 mb-8">
          The full free experience — CSV upload, all writing modes — just
          without an account.{" "}
          {usage && (
            <span className="font-mono text-xs text-mist">
              {usage.used}/{usage.limit} used today
            </span>
          )}
        </p>

        <div className="frosted rounded-2xl p-6 space-y-4">
          <input
            type="text"
            placeholder="Your name (for the email sign-off)"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
          />

          <div className="flex items-center gap-4 text-sm flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={mode === "personalized"} onChange={() => setMode("personalized")} />
              Personalized per lead
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={mode === "sameForAll"} onChange={() => setMode("sameForAll")} />
              Same message for everyone
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={mode === "ownTemplate"} onChange={() => setMode("ownTemplate")} />
              I&apos;ll write my own template
            </label>
          </div>

          {mode === "ownTemplate" ? (
            <textarea
              placeholder={"Hi {name},\n\nI wanted to reach out to {company} about...\n\n(Use {name} and {company})"}
              value={ownTemplateText}
              onChange={(e) => setOwnTemplateText(e.target.value)}
              rows={5}
              className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
            />
          ) : (
            <>
              <textarea
                placeholder="Your product/service description"
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                rows={2}
                className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
              />
              <div className="grid md:grid-cols-2 gap-4">
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
                >
                  <option value="friendly">Friendly</option>
                  <option value="formal">Formal</option>
                  <option value="short">Short &amp; direct</option>
                  <option value="casual">Casual</option>
                </select>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="Russian">Russian</option>
                  <option value="Uzbek">Uzbek</option>
                </select>
              </div>
            </>
          )}

          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setLeadInputMode("paste")}
              className={`px-3 py-1.5 rounded-full border transition-colors ${
                leadInputMode === "paste" ? "bg-glacier text-frost border-glacier" : "border-glacier/15 text-glacier/70"
              }`}
            >
              Paste text
            </button>
            <button
              type="button"
              onClick={() => setLeadInputMode("csv")}
              className={`px-3 py-1.5 rounded-full border transition-colors ${
                leadInputMode === "csv" ? "bg-glacier text-frost border-glacier" : "border-glacier/15 text-glacier/70"
              }`}
            >
              Upload CSV
            </button>
          </div>

          {leadInputMode === "paste" ? (
            <textarea
              placeholder={"John Smith, Acme Inc, acme.com\nJane Doe, Northwind, launching in EU next month"}
              value={leadsRaw}
              onChange={(e) => setLeadsRaw(e.target.value)}
              rows={5}
              className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70 font-mono text-sm"
            />
          ) : (
            <div className="space-y-3">
              <label className="block border-2 border-dashed border-glacier/20 rounded-xl px-4 py-6 text-center cursor-pointer hover:border-thaw transition-colors">
                <input type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
                <span className="text-sm text-glacier/70">
                  {csvFileName ? `📄 ${csvFileName}` : "Click to choose a CSV file"}
                </span>
              </label>
              {csvError && <p className="text-xs text-thaw">{csvError}</p>}
              {csvHeaders.length > 0 && (
                <div className="border border-glacier/15 rounded-xl p-4 space-y-3 bg-white/70">
                  <p className="text-xs font-medium text-glacier/80">Match your columns</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(["name", "company", "context", "email"] as const).map((field) => (
                      <div key={field}>
                        <label className="text-[11px] text-mist block mb-1 capitalize">
                          {field}{(field === "name" || field === "email") && " *"}
                        </label>
                        <select
                          value={csvMapping[field]}
                          onChange={(e) => setCsvMapping((p) => ({ ...p, [field]: e.target.value }))}
                          className="w-full border border-glacier/15 rounded-lg px-2 py-1.5 text-xs bg-white"
                        >
                          <option value="">-- none --</option>
                          {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
              {needsSignup && (
                <a href="/login?mode=signup" className="ml-3 underline font-medium">
                  Sign up free →
                </a>
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
              onClick={() =>
                confirm(
                  "Gmail auto-drafts are a Pro feature. Sign up now? (takes 10 seconds, no card needed)"
                ) && (window.location.href = "/login?mode=signup")
              }
              className="text-sm font-medium px-4 py-2.5 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
            >
              Connect Gmail (Pro)
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="mt-8 space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const escapeCsv = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
                  const header = ["Name", "Company", "Email"];
                  const rows = results.map((r) => [r.lead.name, r.lead.company, r.email]);
                  const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
                  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "icebreak-demo.csv";
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }}
                className="text-sm font-medium px-4 py-2 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
              >
                Download CSV
              </button>
            </div>
            {results.map((r, i) => (
              <div key={i} className="rounded-2xl p-5 border bg-white border-glacier/10">
                <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
                  <p className="font-mono text-xs text-thaw">#{i + 1} {r.lead.name} · {r.lead.company}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(r.email, i)}
                      className="text-xs font-medium px-3 py-1.5 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
                    >
                      {copiedIndex === i ? "Copied ✓" : "Copy"}
                    </button>
                    <button
                      onClick={() => {
                        const mailto = `mailto:${r.lead.email || ""}?subject=${encodeURIComponent(
                          `Quick question, ${r.lead.name}`
                        )}&body=${encodeURIComponent(r.email)}`;
                        window.open(
                          `/mailto-redirect?to=${encodeURIComponent(mailto)}`,
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }}
                      className="text-xs font-medium px-3 py-1.5 rounded-full bg-thaw text-white hover:brightness-105 transition"
                    >
                      Open in email
                    </button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap text-glacier/90">
                  {r.email || "(couldn't generate this one — try again)"}
                </p>
              </div>
            ))}

            <div className="frosted rounded-2xl p-6 text-center mt-8">
              <p className="font-display text-lg font-semibold mb-2">Like what you see?</p>
              <p className="text-sm text-glacier/70 mb-4">
                Sign up free to save your work, get history, and unlock Gmail auto-drafts on Pro.
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