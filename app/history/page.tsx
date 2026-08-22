"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabaseClient } from "@/lib/supabaseClient";

type HistoryItem = {
  id: number;
  lead_name: string;
  lead_company: string;
  lead_email: string;
  mode: string;
  opener: string;
  email_body: string;
  created_at: string;
};

const MODE_LABELS: Record<string, string> = {
  personalized: "Personalized",
  sameForAll: "Same for all",
  ownTemplate: "Own template",
};

export default function HistoryPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [accessToken, setAccessToken] = useState("");

  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearAllConfirmText, setClearAllConfirmText] = useState("");
  const [clearingAll, setClearingAll] = useState(false);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login");
        return;
      }
      setAccessToken(data.session.access_token);
      setAuthChecked(true);
    });
  }, [router]);

  useEffect(() => {
    if (accessToken) fetchHistory(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Debounced server-side search + date filters — always re-fetches from
  // the start when any filter changes, covering the FULL history.
  useEffect(() => {
    if (!accessToken) return;
    const timeout = setTimeout(() => {
      fetchHistory(0);
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, fromDate, toDate]);

  function buildFilterParams(offset: number) {
    const params = new URLSearchParams();
    params.set("offset", String(offset));
    if (query) params.set("q", query);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    return params.toString();
  }

  async function fetchHistory(offset: number) {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await fetch(`/api/history?${buildFilterParams(offset)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setIsPro(!!data.isPro);
        return;
      }
      setIsPro(true);
      setItems((prev) => (offset === 0 ? data.items : [...prev, ...data.items]));
      setTotal(data.total);
      setHasMore(data.hasMore);
      if (offset === 0) setSelected(new Set());
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function copyToClipboard(text: string, id: number) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function buildMailtoLink(item: HistoryItem) {
    const subject = encodeURIComponent(`Quick question, ${item.lead_name}`);
    const body = encodeURIComponent(item.email_body);
    return `mailto:${item.lead_email || ""}?subject=${subject}&body=${body}`;
  }

  async function deleteItem(id: number) {
    if (!confirm("Delete this from your history? This can't be undone.")) return;
    try {
      const res = await fetch(`/api/history?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        setTotal((prev) => prev - 1);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    } catch {
      // Non-critical — user can retry
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected item(s)? This can't be undone.`))
      return;
    setDeletingSelected(true);
    try {
      const ids = Array.from(selected).join(",");
      const res = await fetch(`/api/history?ids=${ids}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => !selected.has(i.id)));
        setTotal((prev) => prev - selected.size);
        setSelected(new Set());
      }
    } finally {
      setDeletingSelected(false);
    }
  }

  async function handleClearAll() {
    if (clearAllConfirmText.toLowerCase() !== "delete") return;
    setClearingAll(true);
    try {
      const params = new URLSearchParams();
      params.set("all", "1");
      if (query) params.set("q", query);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/history?${params.toString()}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setItems([]);
        setTotal(0);
        setSelected(new Set());
        setShowClearAllModal(false);
        setClearAllConfirmText("");
      }
    } finally {
      setClearingAll(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      let itemsToExport: HistoryItem[];

      if (selected.size > 0) {
        // Only the checked items — these are always among the currently
        // loaded ones, so no extra fetch is needed.
        itemsToExport = items.filter((i) => selected.has(i.id));
      } else {
        // Nothing selected — export everything matching the current
        // search/date filters (up to 5000, fetched fresh from the server).
        const params = new URLSearchParams();
        params.set("export", "1");
        if (query) params.set("q", query);
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);
        const res = await fetch(`/api/history?${params.toString()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (!res.ok) return;
        itemsToExport = data.items as HistoryItem[];
      }

      const escapeCsv = (value: string) =>
        `"${(value || "").replace(/"/g, '""')}"`;
      const header = ["Name", "Company", "Email", "Mode", "Date", "Message"];
      const rows = itemsToExport.map((i) => [
        i.lead_name,
        i.lead_company,
        i.lead_email,
        MODE_LABELS[i.mode] || i.mode,
        new Date(i.created_at).toLocaleString(),
        i.email_body,
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
      link.download = "icebreak-history.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function useAsTemplate(item: HistoryItem) {
    let templated = item.email_body;
    if (item.lead_name) {
      templated = templated.split(item.lead_name).join("{name}");
    }
    if (item.lead_company) {
      templated = templated.split(item.lead_company).join("{company}");
    }
    try {
      sessionStorage.setItem("icebreak_seed_template", templated);
    } catch {
      // ignore
    }
    router.push("/tool");
  }

  function handleUpgrade() {
    const baseUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL;
    window.location.href = baseUrl as string;
  }

  const hasActiveFilters = !!(query || fromDate || toDate);

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-frost flex items-center justify-center">
        <p className="text-sm text-glacier/50">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-frost">
      <Navbar variant="app" />

      <section className="max-w-4xl mx-auto px-6 pb-24">
        <h1 className="font-display text-3xl font-semibold mb-2">History</h1>
        <p className="text-glacier/70 mb-8">
          Every email you've generated, saved automatically.
        </p>

        {loading ? (
          <p className="text-sm text-glacier/60">Loading...</p>
        ) : isPro === false ? (
          <div className="frosted rounded-2xl p-8 text-center">
            <p className="font-display text-lg font-semibold mb-2">
              History is a Pro feature
            </p>
            <p className="text-sm text-glacier/70 mb-6 max-w-sm mx-auto">
              Upgrade to Pro to automatically save and revisit every email
              you've ever generated — never lose your work again.
            </p>
            <button
              onClick={handleUpgrade}
              className="bg-thaw text-white font-medium px-6 py-3 rounded-full hover:brightness-105 transition"
            >
              Upgrade to Pro — $19/mo
            </button>
          </div>
        ) : items.length === 0 && !hasActiveFilters ? (
          <p className="text-sm text-glacier/60">
            Nothing generated yet — your history will appear here.
          </p>
        ) : (
          <>
            {/* Filters */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <input
                type="text"
                placeholder="Search by name or company..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="border border-glacier/15 rounded-xl px-4 py-2 bg-white/70 text-sm flex-1 min-w-[180px]"
              />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border border-glacier/15 rounded-xl px-3 py-2 bg-white/70 text-sm"
                title="From date"
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border border-glacier/15 rounded-xl px-3 py-2 bg-white/70 text-sm"
                title="To date"
              />
              <span className="text-xs text-mist font-mono whitespace-nowrap">
                {total} total
              </span>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <label className="flex items-center gap-1.5 text-xs text-mist cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.size === items.length && items.length > 0}
                  onChange={toggleSelectAll}
                />
                Select all ({selected.size > 0 ? `${selected.size} selected` : "none"})
              </label>
              <div className="flex gap-2 flex-wrap">
                {selected.size > 0 && (
                  <button
                    onClick={deleteSelected}
                    disabled={deletingSelected}
                    className="text-sm font-medium px-4 py-2 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deletingSelected ? "Deleting..." : `Delete selected (${selected.size})`}
                  </button>
                )}
                <button
                  onClick={handleExport}
                  disabled={exporting || items.length === 0}
                  className="text-sm font-medium px-4 py-2 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors disabled:opacity-50"
                >
                  {exporting
                    ? "Exporting..."
                    : selected.size > 0
                    ? `Export selected (${selected.size})`
                    : "Export all as CSV"}
                </button>
                <button
                  onClick={() => setShowClearAllModal(true)}
                  disabled={total === 0}
                  className="text-sm font-medium px-4 py-2 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Clear all
                </button>
              </div>
            </div>

            {items.length === 0 && hasActiveFilters ? (
              <p className="text-sm text-glacier/60">No results match your filters.</p>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl p-5 border bg-white transition-shadow ${
                      selected.has(item.id) ? "border-thaw ring-1 ring-thaw" : "border-glacier/10"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                        <div>
                          <p className="font-mono text-xs text-thaw flex items-center gap-2">
                            <span className="text-mist">#{index + 1}</span>
                            {item.lead_name || "Unnamed"} · {item.lead_company || "—"}
                            <span className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-full bg-glacier/10 text-mist">
                              {MODE_LABELS[item.mode] || item.mode}
                            </span>
                          </p>
                          <p className="font-mono text-[11px] text-mist">
                            {item.lead_email || "no email provided"} ·{" "}
                            {new Date(item.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => copyToClipboard(item.email_body, item.id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
                        >
                          {copiedId === item.id ? "Copied ✓" : "Copy"}
                        </button>
                        <button
                          onClick={() =>
                            window.open(
                              `/mailto-redirect?to=${encodeURIComponent(buildMailtoLink(item))}`,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                          className="text-xs font-medium px-3 py-1.5 rounded-full bg-thaw text-white hover:brightness-105 transition"
                        >
                          Open in email
                        </button>
                        {item.mode !== "personalized" && (
                          <button
                            onClick={() => useAsTemplate(item)}
                            className="text-xs font-medium px-3 py-1.5 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
                          >
                            Use as template
                          </button>
                        )}
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-full border border-glacier/15 hover:border-red-300 hover:text-red-500 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-glacier/90">
                      {item.email_body}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => fetchHistory(items.length)}
                  disabled={loadingMore}
                  className="text-sm font-medium px-5 py-2.5 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {showClearAllModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6"
          onClick={() => !clearingAll && setShowClearAllModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-lg font-semibold text-red-700 mb-2">
              Clear all history?
            </p>
            <p className="text-sm text-glacier/70 mb-4">
              {hasActiveFilters
                ? "This deletes every history item matching your current search/date filters. This cannot be undone."
                : "This permanently deletes your ENTIRE generation history. This cannot be undone."}
            </p>
            <p className="text-xs text-glacier/70 mb-1">
              Type <span className="font-mono font-semibold">delete</span> to confirm:
            </p>
            <input
              type="text"
              value={clearAllConfirmText}
              onChange={(e) => setClearAllConfirmText(e.target.value)}
              placeholder="delete"
              autoFocus
              className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 mb-4 font-mono text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowClearAllModal(false);
                  setClearAllConfirmText("");
                }}
                disabled={clearingAll}
                className="flex-1 text-sm font-medium px-4 py-2.5 rounded-full border border-glacier/15 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                disabled={clearingAll || clearAllConfirmText.toLowerCase() !== "delete"}
                className="flex-1 text-sm font-medium px-4 py-2.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:hover:bg-red-600"
              >
                {clearingAll ? "Clearing..." : "Clear all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}