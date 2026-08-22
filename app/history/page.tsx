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

  async function fetchHistory(offset: number) {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await fetch(`/api/history?offset=${offset}`, {
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
      }
    } catch {
      // Non-critical — user can retry
    }
  }

  function useAsTemplate(item: HistoryItem) {
    // Replace this lead's specific name/company with {name}/{company}
    // placeholders so it can be reused as a template for other leads.
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
      // sessionStorage may be unavailable — proceed anyway, tool page
      // will just show the normal empty template field
    }
    router.push("/tool");
  }

  function handleUpgrade() {
    const baseUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL;
    window.location.href = baseUrl as string;
  }

  const filteredItems = query
    ? items.filter(
        (i) =>
          i.lead_name?.toLowerCase().includes(query.toLowerCase()) ||
          i.lead_company?.toLowerCase().includes(query.toLowerCase())
      )
    : items;

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
        ) : items.length === 0 ? (
          <p className="text-sm text-glacier/60">
            Nothing generated yet — your history will appear here.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <input
                type="text"
                placeholder="Search by name or company..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="border border-glacier/15 rounded-xl px-4 py-2 bg-white/70 text-sm w-full max-w-xs"
              />
              <span className="text-xs text-mist font-mono">{total} total</span>
            </div>

            <div className="space-y-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl p-5 border bg-white border-glacier/10"
                >
                  <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
                    <div>
                      <p className="font-mono text-xs text-thaw flex items-center gap-2">
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

            {hasMore && !query && (
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
    </main>
  );
}