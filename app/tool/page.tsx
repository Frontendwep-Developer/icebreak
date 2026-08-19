"use client";

import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import Navbar from "@/components/Navbar";

type Lead = { name: string; company: string; context: string; email: string };
type ResultItem = {
  lead: Lead;
  opener: string;
  email: string;
};
type CsvMapping = {
  name: string;
  company: string;
  context: string;
  email: string;
};

const GMAIL_BATCH_SIZE = 10;
const MAX_LEADS = 25;

export default function ToolPage() {
  const [email, setEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmailOption, setSenderEmailOption] = useState<"account" | "other">("account");
  const [customSenderEmail, setCustomSenderEmail] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [tone, setTone] = useState("friendly");
  const [language, setLanguage] = useState("English");
  const [mode, setMode] = useState<"personalized" | "sameForAll" | "ownTemplate">(
    "personalized"
  );
  const [ownTemplateText, setOwnTemplateText] = useState("");
  const [leadsRaw, setLeadsRaw] = useState("");
  const [leadInputMode, setLeadInputMode] = useState<"paste" | "csv">("paste");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvMapping, setCsvMapping] = useState<CsvMapping>({
    name: "",
    company: "",
    context: "",
    email: "",
  });
  const [csvFileName, setCsvFileName] = useState("");
  const [csvError, setCsvError] = useState("");
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
  const [followups, setFollowups] = useState<any[]>([]);
  const [followupBusyId, setFollowupBusyId] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editTone, setEditTone] = useState("friendly");
  const [editLanguage, setEditLanguage] = useState("English");
  const [editLeadName, setEditLeadName] = useState("");
  const [editLeadEmail, setEditLeadEmail] = useState("");
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(
    null
  );
  const [gmailProgress, setGmailProgress] = useState<{
    sent: number;
    total: number;
    skipped: number;
  } | null>(null);
  const [gmailBatchError, setGmailBatchError] = useState("");
  const [editedIndices, setEditedIndices] = useState<Set<number>>(new Set());
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail_connected")) setGmailStatus("connected");
    if (params.get("gmail_error")) setGmailStatus("error");

    // Restore saved template (email, sender name, product description, tone, language)
    try {
      const saved = localStorage.getItem("icebreak_template");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.senderName) setSenderName(parsed.senderName);
        if (parsed.productDescription)
          setProductDescription(parsed.productDescription);
        if (parsed.tone) setTone(parsed.tone);
        if (parsed.language) setLanguage(parsed.language);
      }
    } catch {
      // ignore corrupted storage
    }
  }, []);

  // Save template whenever these fields change, so returning users don't
  // have to retype them
  useEffect(() => {
    try {
      localStorage.setItem(
        "icebreak_template",
        JSON.stringify({ email, senderName, productDescription, tone, language })
      );
    } catch {
      // localStorage may be unavailable (e.g. private browsing) — safe to ignore
    }
  }, [email, senderName, productDescription, tone, language]);

  // Fetch due follow-up reminders whenever we know the user's email
  useEffect(() => {
    if (!email) return;
    fetchFollowups();
  }, [email]);

  async function fetchFollowups() {
    if (!email) return;
    try {
      const res = await fetch(
        `/api/followups?email=${encodeURIComponent(email)}`
      );
      const data = await res.json();
      if (res.ok) setFollowups(data.due || []);
    } catch {
      // Non-critical — silently ignore
    }
  }

  async function confirmFollowup(id: string) {
    setFollowupBusyId(id);
    try {
      const res = await fetch("/api/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create follow-up");
        return;
      }
      setFollowups((prev) => prev.filter((f) => f.id !== id));
    } catch (e: any) {
      setError("Network error: " + e.message);
    } finally {
      setFollowupBusyId(null);
    }
  }

  async function dismissFollowup(id: string) {
    setFollowupBusyId(id);
    try {
      await fetch("/api/followups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, id }),
      });
      setFollowups((prev) => prev.filter((f) => f.id !== id));
    } finally {
      setFollowupBusyId(null);
    }
  }

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

  // --- CSV upload ---

  function guessMapping(headers: string[]): CsvMapping {
    const find = (keywords: string[]) =>
      headers.find((h) =>
        keywords.some((k) => h.toLowerCase().includes(k))
      ) || "";

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
      complete: (results) => {
        const fields = (results.meta.fields || []).filter(Boolean);
        if (fields.length === 0) {
          setCsvError("Couldn't read any columns from this file.");
          return;
        }
        const rows = results.data as Record<string, string>[];
        setCsvHeaders(fields);
        setCsvRows(rows.slice(0, MAX_LEADS));
        setCsvMapping(guessMapping(fields));
        if (rows.length > MAX_LEADS) {
          setCsvError(
            `This file has ${rows.length} rows — only the first ${MAX_LEADS} will be used per batch.`
          );
        }
      },
      error: (err) => {
        setCsvError("Couldn't parse this file: " + err.message);
      },
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
    setNeedsUpgrade(false);

    if (!email) {
      setError("Please set your account email first");
      return;
    }
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

    const leads =
      leadInputMode === "csv" ? buildLeadsFromCsv() : parseLeads(leadsRaw);
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
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
        setNeedsUpgrade(!!data.upgrade);
        return;
      }
      setResults(data.results);
      setSelected(new Set());
      setEditedIndices(new Set());
      setHighlightIndex(null);
      if (mode === "ownTemplate") {
        setUsage(null);
      } else {
        setUsage({ used: data.creditsUsed, limit: data.limit });
      }
      if (data.capacityMessage) {
        setError(data.capacityMessage);
      } else if (data.failed > 0) {
        setError(
          `${data.failed} lead${
            data.failed > 1 ? "s" : ""
          } couldn't be generated (shown as empty below) — you can retry them individually with Edit → Regenerate.`
        );
      }
    } catch (e: any) {
      setError("Network error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleUpgrade() {
    if (!email) {
      setError("Please set your account email first");
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
      setError("Please set your account email first");
      return;
    }
    window.location.href = `/api/auth/google?email=${encodeURIComponent(email)}`;
  }

  function clearSavedTemplate() {
    localStorage.removeItem("icebreak_template");
    setEmail("");
    setSenderName("");
    setProductDescription("");
    setTone("friendly");
    setLanguage("English");
  }

  function saveEmailChange() {
    if (!emailInput.trim()) return;
    setEmail(emailInput.trim());
    setEditingEmail(false);
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
    setEditedIndices(new Set());
    setHighlightIndex(null);
    setMobileSheetOpen(false);
  }

  function deleteSelected() {
    const remainingOldIndices = results
      .map((_, i) => i)
      .filter((i) => !selected.has(i));
    setResults((prev) => prev.filter((_, i) => !selected.has(i)));
    setEditedIndices((prev) => {
      const next = new Set<number>();
      remainingOldIndices.forEach((oldIdx, newIdx) => {
        if (prev.has(oldIdx)) next.add(newIdx);
      });
      return next;
    });
    setSelected(new Set());
  }

  // --- Edit ---

  function startEdit(i: number) {
    setEditingIndex(i);
    setEditText(results[i].email);
    setEditTone(tone);
    setEditLanguage(language);
    setEditLeadName(results[i].lead.name);
    setEditLeadEmail(results[i].lead.email);
  }

  function saveEdit(i: number) {
    setResults((prev) =>
      prev.map((r, idx) =>
        idx === i
          ? {
              ...r,
              email: editText,
              lead: { ...r.lead, name: editLeadName, email: editLeadEmail },
            }
          : r
      )
    );
    setEditedIndices((prev) => new Set(prev).add(i));
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
          tone: editTone,
          language: editLanguage,
          leads: [
            { ...results[i].lead, name: editLeadName, email: editLeadEmail },
          ],
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
      setEditedIndices((prev) => {
        const next = new Set(prev);
        next.delete(i);
        return next;
      });
      setUsage({ used: data.creditsUsed, limit: data.limit });
      setEditingIndex(null);
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
    // Refresh follow-up reminders since we just tracked new sent emails
    fetchFollowups();
  }

  // --- Lead status sidebar ---

  function scrollToCard(i: number) {
    setHighlightIndex(i);
    cardRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setMobileSheetOpen(false);
    setTimeout(() => {
      setHighlightIndex((cur) => (cur === i ? null : cur));
    }, 1500);
  }

  function statusFor(r: ResultItem, i: number) {
    if (!r.email.trim()) return { label: "Empty", cls: "text-mist" };
    if (editedIndices.has(i)) return { label: "Edited", cls: "text-thaw" };
    return { label: "Ready", cls: "text-green-600" };
  }

  function renderStatusList() {
    return (
      <ul className="space-y-1">
        {results.map((r, i) => {
          const status = statusFor(r, i);
          return (
            <li key={i}>
              <button
                onClick={() => scrollToCard(i)}
                className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-glacier/5 transition-colors"
              >
                <span className="text-xs truncate">
                  <span className="text-mist font-mono mr-1">{i + 1}.</span>
                  {r.lead.name || "Unnamed"}
                </span>
                <span className={`text-[10px] font-medium shrink-0 ${status.cls}`}>
                  {status.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <main className="min-h-screen bg-frost">
      <Navbar variant="app" />

      <section className="max-w-4xl mx-auto px-6 pb-24">
        <h1 className="font-display text-3xl font-semibold mb-2">
          Generate your emails
        </h1>

        {/* Account identity — separate from the "sender name" used inside emails */}
        <div className="mb-4 flex items-center gap-2 flex-wrap text-sm">
          {editingEmail ? (
            <>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
                className="border border-glacier/15 rounded-xl px-3 py-1.5 bg-white/70"
                autoFocus
              />
              <button
                onClick={saveEmailChange}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-thaw text-white"
              >
                Save
              </button>
              <button
                onClick={() => setEditingEmail(false)}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-glacier/15"
              >
                Cancel
              </button>
            </>
          ) : (
            <span className="text-glacier/70">
              Signed in as{" "}
              <span className="font-mono text-glacier">
                {email || "no email set"}
              </span>{" "}
              ·{" "}
              <button
                onClick={() => {
                  setEmailInput(email);
                  setEditingEmail(true);
                }}
                className="text-thaw underline"
              >
                Change
              </button>
              {usage && (
                <span className="font-mono text-xs text-mist ml-2">
                  · {usage.used} / {usage.limit} used
                </span>
              )}
            </span>
          )}
        </div>

        <p className="text-glacier/70 mb-8">
          One lead per line:{" "}
          <span className="font-mono text-sm">Name, Company, Context, Email</span>
          {" · "}
          <button
            onClick={clearSavedTemplate}
            className="underline text-mist hover:text-thaw"
          >
            reset saved details
          </button>
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

        {followups.length > 0 && (
          <div className="mb-4 border border-thaw/30 bg-thaw/5 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-medium text-glacier">
              ⏰ {followups.length} follow-up
              {followups.length > 1 ? "s" : ""} due
            </p>
            {followups.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 bg-white rounded-xl px-4 py-2.5 flex-wrap"
              >
                <span className="text-sm text-glacier/80">
                  {f.lead_name} · {f.lead_company} — sent{" "}
                  {new Date(f.drafted_at).toLocaleDateString()}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => confirmFollowup(f.id)}
                    disabled={followupBusyId === f.id}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-thaw text-white hover:brightness-105 transition disabled:opacity-50"
                  >
                    {followupBusyId === f.id
                      ? "Creating..."
                      : "Draft follow-up"}
                  </button>
                  <button
                    onClick={() => dismissFollowup(f.id)}
                    disabled={followupBusyId === f.id}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-glacier/15 hover:border-thaw transition disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="frosted rounded-2xl p-6 space-y-4">
          <input
            type="text"
            placeholder="Your name (for the email sign-off)"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
          />
          <div>
            <label className="text-xs text-mist block mb-1">Send from</label>
            <select
              value={senderEmailOption}
              onChange={(e) =>
                setSenderEmailOption(e.target.value as "account" | "other")
              }
              className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
            >
              <option value="account">{email || "your account email"}</option>
              <option value="other">Use a different email...</option>
            </select>
            {senderEmailOption === "other" && (
              <div className="flex gap-2 mt-2">
                <input
                  type="email"
                  placeholder="you@yourcompany.com"
                  value={customSenderEmail}
                  onChange={(e) => setCustomSenderEmail(e.target.value)}
                  className="flex-1 border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
                />
                <button
                  disabled
                  className="text-sm font-medium px-4 py-2.5 rounded-full border border-glacier/15 text-glacier/40 cursor-not-allowed whitespace-nowrap"
                >
                  Connect email
                </button>
              </div>
            )}
            {senderEmailOption === "other" && (
              <p className="text-xs text-mist mt-1">
                Sending from a different email is coming soon — you&apos;ll
                be able to connect it here.
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={mode === "personalized"}
                onChange={() => setMode("personalized")}
              />
              Personalized per lead
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={mode === "sameForAll"}
                onChange={() => setMode("sameForAll")}
              />
              Same message for everyone
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={mode === "ownTemplate"}
                onChange={() => setMode("ownTemplate")}
              />
              I&apos;ll write my own template
            </label>
          </div>

          {mode === "ownTemplate" ? (
            <div>
              <textarea
                placeholder={
                  "Hi {name},\n\nI wanted to reach out to {company} about...\n\n(Use {name} and {company} — they'll be filled in automatically for each lead.)"
                }
                value={ownTemplateText}
                onChange={(e) => setOwnTemplateText(e.target.value)}
                rows={6}
                className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
              />
              <p className="text-xs text-mist mt-1">
                💡 No AI writing here — this just fills in{" "}
                <span className="font-mono">{"{name}"}</span> and{" "}
                <span className="font-mono">{"{company}"}</span> for each
                lead. Free for everyone, capped at 200/month to prevent abuse.
              </p>
            </div>
          ) : (
            <>
              <textarea
                placeholder="Your product/service description (e.g. I help small e-commerce brands run Meta ads)"
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                rows={2}
                className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
              />
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-mist block mb-1">Tone</label>
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
                </div>
                <div>
                  <label className="text-xs text-mist block mb-1">
                    Output language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Portuguese">Portuguese</option>
                    <option value="Russian">Russian</option>
                    <option value="Uzbek">Uzbek</option>
                    <option value="Turkish">Turkish</option>
                    <option value="Italian">Italian</option>
                  </select>
                  {language !== "English" && (
                    <p className="text-[11px] text-thaw mt-1">
                      ⚠️ Non-English output is in early testing — please
                      review before sending, occasional word mix-ups can
                      happen.
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-mist -mt-2">
                {mode === "sameForAll" ? (
                  <>
                    💡 Everyone gets the same message. Context is ignored in
                    this mode — only{" "}
                    <span className="font-mono">{"{name}"}</span> and{" "}
                    <span className="font-mono">{"{company}"}</span> get
                    filled in automatically per lead.
                  </>
                ) : (
                  <>
                    💡 Instead of typing context, you can paste a company
                    website (e.g. <span className="font-mono">acme.com</span>)
                    and Icebreak will read it for you.
                  </>
                )}
              </p>
            </>
          )}

          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setLeadInputMode("paste")}
              className={`px-3 py-1.5 rounded-full border transition-colors ${
                leadInputMode === "paste"
                  ? "bg-glacier text-frost border-glacier"
                  : "border-glacier/15 text-glacier/70 hover:border-thaw"
              }`}
            >
              Paste text
            </button>
            <button
              type="button"
              onClick={() => setLeadInputMode("csv")}
              className={`px-3 py-1.5 rounded-full border transition-colors ${
                leadInputMode === "csv"
                  ? "bg-glacier text-frost border-glacier"
                  : "border-glacier/15 text-glacier/70 hover:border-thaw"
              }`}
            >
              Upload CSV
            </button>
          </div>

          {leadInputMode === "paste" ? (
            <textarea
              placeholder={
                "John Smith, Acme Inc, acme.com, john@acme.com\nJane Doe, Northwind, website mentions launching in EU next month, jane@northwind.com"
              }
              value={leadsRaw}
              onChange={(e) => setLeadsRaw(e.target.value)}
              rows={6}
              className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70 font-mono text-sm"
            />
          ) : (
            <div className="space-y-3">
              <label className="block border-2 border-dashed border-glacier/20 rounded-xl px-4 py-6 text-center cursor-pointer hover:border-thaw transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFile}
                  className="hidden"
                />
                <span className="text-sm text-glacier/70">
                  {csvFileName
                    ? `📄 ${csvFileName} — click to choose a different file`
                    : "Click to choose a CSV file (exported from Excel or Google Sheets)"}
                </span>
              </label>

              {csvError && (
                <p className="text-xs text-thaw">{csvError}</p>
              )}

              {csvHeaders.length > 0 && (
                <div className="border border-glacier/15 rounded-xl p-4 space-y-3 bg-white/70">
                  <p className="text-xs font-medium text-glacier/80">
                    Match your columns
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {(["name", "company", "context", "email"] as const).map(
                      (field) => (
                        <div key={field}>
                          <label className="text-[11px] text-mist block mb-1 capitalize">
                            {field}
                            {(field === "name" || field === "email") && " *"}
                          </label>
                          <select
                            value={csvMapping[field]}
                            onChange={(e) =>
                              setCsvMapping((prev) => ({
                                ...prev,
                                [field]: e.target.value,
                              }))
                            }
                            className="w-full border border-glacier/15 rounded-lg px-2 py-1.5 text-xs bg-white"
                          >
                            <option value="">-- none --</option>
                            {csvHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    )}
                  </div>

                  {csvRows.length > 0 && (
                    <div>
                      <p className="text-[11px] text-mist mb-1">
                        Preview ({csvRows.length} row
                        {csvRows.length > 1 ? "s" : ""} total)
                      </p>
                      <div className="overflow-x-auto">
                        <table className="text-xs w-full">
                          <thead>
                            <tr className="text-mist">
                              <th className="text-left pr-3 py-1">Name</th>
                              <th className="text-left pr-3 py-1">Company</th>
                              <th className="text-left pr-3 py-1">Context</th>
                              <th className="text-left pr-3 py-1">Email</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvRows.slice(0, 3).map((row, idx) => (
                              <tr key={idx} className="border-t border-glacier/10">
                                <td className="pr-3 py-1">
                                  {csvMapping.name ? row[csvMapping.name] : "—"}
                                </td>
                                <td className="pr-3 py-1">
                                  {csvMapping.company
                                    ? row[csvMapping.company]
                                    : "—"}
                                </td>
                                <td className="pr-3 py-1">
                                  {csvMapping.context
                                    ? row[csvMapping.context]
                                    : "—"}
                                </td>
                                <td className="pr-3 py-1">
                                  {csvMapping.email ? row[csvMapping.email] : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
            <span className="text-xs text-mist">
              {mode === "sameForAll"
                ? "Uses 1 credit total, no matter how many leads"
                : mode === "ownTemplate"
                ? "Free — doesn't use your AI credits"
                : "Uses 1 credit per lead"}
            </span>
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
                {mode === "sameForAll" && (
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="text-sm font-medium px-4 py-2 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors disabled:opacity-50"
                  >
                    {loading ? "Regenerating..." : "Regenerate shared message"}
                  </button>
                )}
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

            {results.map((r, i) => {
              const isEmpty = !r.email.trim();
              return (
              <div
                key={i}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                className={`rounded-2xl p-5 border transition-shadow ${
                  isEmpty
                    ? "bg-glacier/5 border-dashed border-glacier/20"
                    : "bg-white border-glacier/10"
                } ${highlightIndex === i ? "ring-2 ring-thaw" : ""}`}
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
                      <p className="font-mono text-xs text-thaw flex items-center gap-2">
                        {r.lead.name} · {r.lead.company}
                        {isEmpty && (
                          <span className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-full bg-glacier/10 text-mist">
                            Empty
                          </span>
                        )}
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
                  </div>
                </div>

                {editingIndex === i ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editLeadName}
                        onChange={(e) => setEditLeadName(e.target.value)}
                        placeholder="Lead name"
                        className="border border-glacier/15 rounded-xl px-3 py-1.5 text-xs bg-white/70"
                      />
                      <input
                        type="email"
                        value={editLeadEmail}
                        onChange={(e) => setEditLeadEmail(e.target.value)}
                        placeholder="Lead email"
                        className="border border-glacier/15 rounded-xl px-3 py-1.5 text-xs bg-white/70"
                      />
                    </div>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={5}
                      className="w-full border border-glacier/15 rounded-xl px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={editTone}
                        onChange={(e) => setEditTone(e.target.value)}
                        className="border border-glacier/15 rounded-xl px-3 py-1.5 text-xs bg-white/70"
                      >
                        <option value="friendly">Friendly</option>
                        <option value="formal">Formal</option>
                        <option value="short">Short &amp; direct</option>
                        <option value="casual">Casual</option>
                      </select>
                      <select
                        value={editLanguage}
                        onChange={(e) => setEditLanguage(e.target.value)}
                        className="border border-glacier/15 rounded-xl px-3 py-1.5 text-xs bg-white/70"
                      >
                        <option value="English">English</option>
                        <option value="Spanish">Spanish</option>
                        <option value="French">French</option>
                        <option value="German">German</option>
                        <option value="Portuguese">Portuguese</option>
                        <option value="Russian">Russian</option>
                        <option value="Uzbek">Uzbek</option>
                        <option value="Turkish">Turkish</option>
                        <option value="Italian">Italian</option>
                      </select>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => saveEdit(i)}
                        className="text-xs font-medium px-3 py-1.5 rounded-full bg-thaw text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => regenerate(i)}
                        disabled={regeneratingIndex === i}
                        className="text-xs font-medium px-3 py-1.5 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors disabled:opacity-50"
                      >
                        {regeneratingIndex === i
                          ? "Regenerating..."
                          : "Regenerate (1 credit)"}
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
                  <p className="text-sm whitespace-pre-wrap text-glacier/90">
                    {r.email}
                  </p>
                )}
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Desktop sidebar — lead status list */}
      {results.length > 0 && (
        <div className="hidden lg:block fixed right-4 top-28 w-60 max-h-[70vh] overflow-y-auto bg-white/95 backdrop-blur-sm border border-glacier/10 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-mono text-mist mb-2">
            {results.filter((r) => r.email.trim()).length}/{results.length}{" "}
            ready
          </p>
          {renderStatusList()}
        </div>
      )}

      {/* Mobile floating button + bottom sheet — lead status list */}
      {results.length > 0 && (
        <>
          <button
            onClick={() => setMobileSheetOpen(true)}
            className="lg:hidden fixed bottom-6 right-6 z-30 bg-glacier text-frost text-xs font-medium px-4 py-3 rounded-full shadow-lg"
          >
            📋 {results.filter((r) => r.email.trim()).length}/{results.length}{" "}
            ready
          </button>
          {mobileSheetOpen && (
            <>
              <div
                className="lg:hidden fixed inset-0 bg-black/30 z-40"
                onClick={() => setMobileSheetOpen(false)}
              />
              <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-lg max-h-[70vh] overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Leads</p>
                  <button
                    onClick={() => setMobileSheetOpen(false)}
                    className="text-mist text-sm"
                  >
                    Close ✕
                  </button>
                </div>
                {renderStatusList()}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}