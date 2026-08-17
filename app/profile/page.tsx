"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";

type Account = {
  exists: boolean;
  plan: string;
  creditsUsed: number;
  limit: number;
  templateCreditsUsed: number;
  templateLimit: number;
  gmailConnected: boolean;
  defaultFollowupDays?: number;
};

export default function ProfilePage() {
  const [email, setEmail] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [followupDays, setFollowupDays] = useState(3);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("icebreak_template");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setEmail(parsed.email);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (email) fetchAccount();
  }, [email]);

  async function fetchAccount() {
    setLoading(true);
    try {
      const res = await fetch(`/api/account?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (res.ok) {
        setAccount(data);
        if (data.defaultFollowupDays) setFollowupDays(data.defaultFollowupDays);
      }
    } finally {
      setLoading(false);
    }
  }

  function saveEmailChange() {
    if (!emailInput.trim()) return;
    const newEmail = emailInput.trim();
    setEmail(newEmail);
    try {
      const saved = localStorage.getItem("icebreak_template");
      const parsed = saved ? JSON.parse(saved) : {};
      parsed.email = newEmail;
      localStorage.setItem("icebreak_template", JSON.stringify(parsed));
    } catch {
      // ignore
    }
    setEditingEmail(false);
  }

  function handleConnectGmail() {
    window.location.href = `/api/auth/google?email=${encodeURIComponent(email)}`;
  }

  async function handleDisconnectGmail() {
    await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action: "disconnect_gmail" }),
    });
    fetchAccount();
  }

  function handleUpgrade() {
    const baseUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL;
    const url = `${baseUrl}?checkout[email]=${encodeURIComponent(
      email
    )}&checkout[custom][user_email]=${encodeURIComponent(email)}`;
    window.location.href = url;
  }

  async function saveFollowupDays() {
    await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, defaultFollowupDays: followupDays }),
    });
    setSavedMessage("Saved ✓");
    setTimeout(() => setSavedMessage(""), 2000);
  }

  return (
    <main className="min-h-screen bg-frost">
      <Navbar variant="app" />

      <section className="max-w-2xl mx-auto px-6 pb-24">
        <h1 className="font-display text-3xl font-semibold mb-8">Account</h1>

        {/* Account email */}
        <div className="frosted rounded-2xl p-6 mb-4">
          <p className="text-xs text-mist mb-2">Signed in as</p>
          {editingEmail ? (
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder={email || "you@example.com"}
                className="flex-1 border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
              />
              <button
                onClick={saveEmailChange}
                className="bg-thaw text-white font-medium px-4 py-2.5 rounded-full"
              >
                Save
              </button>
              <button
                onClick={() => setEditingEmail(false)}
                className="border border-glacier/15 font-medium px-4 py-2.5 rounded-full"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="font-mono text-lg">{email || "No email set"}</p>
              <button
                onClick={() => {
                  setEmailInput(email);
                  setEditingEmail(true);
                }}
                className="text-sm text-thaw underline"
              >
                Change
              </button>
            </div>
          )}
          <p className="text-xs text-mist mt-2">
            This is the email that identifies your account — your usage,
            plan, and Gmail connection are all tied to it. This is separate
            from the &quot;sender name&quot; used in your emails.
          </p>
        </div>

        {!email ? (
          <p className="text-sm text-glacier/60">
            Enter your account email above to see your account details.
          </p>
        ) : loading ? (
          <p className="text-sm text-glacier/60">Loading...</p>
        ) : account ? (
          <>
            {/* Plan & usage */}
            <div className="frosted rounded-2xl p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-mist">Plan</p>
                <span
                  className={`text-xs font-medium px-3 py-1 rounded-full ${
                    account.plan === "pro"
                      ? "bg-glacier text-frost"
                      : "border border-glacier/15 text-glacier/70"
                  }`}
                >
                  {account.plan === "pro" ? "Pro" : "Free"}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-glacier/70">AI-generated emails</span>
                    <span className="font-mono text-xs">
                      {account.creditsUsed} / {account.limit}
                    </span>
                  </div>
                  <div className="h-1.5 bg-glacier/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-thaw"
                      style={{
                        width: `${Math.min(
                          100,
                          (account.creditsUsed / account.limit) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-glacier/70">
                      Template messages (free, no AI)
                    </span>
                    <span className="font-mono text-xs">
                      {account.templateCreditsUsed} / {account.templateLimit}
                    </span>
                  </div>
                  <div className="h-1.5 bg-glacier/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ice"
                      style={{
                        width: `${Math.min(
                          100,
                          (account.templateCreditsUsed /
                            account.templateLimit) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {account.plan !== "pro" && (
                <button
                  onClick={handleUpgrade}
                  className="mt-4 w-full bg-thaw text-white font-medium py-2.5 rounded-full hover:brightness-105 transition"
                >
                  Upgrade to Pro — $19/mo
                </button>
              )}
            </div>

            {/* Gmail connection */}
            <div className="frosted rounded-2xl p-6 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Gmail</p>
                  <p className="text-xs text-mist mt-0.5">
                    {account.gmailConnected
                      ? "Connected — Icebreak can create drafts in your Gmail"
                      : "Not connected"}
                  </p>
                </div>
                {account.gmailConnected ? (
                  <button
                    onClick={handleDisconnectGmail}
                    className="text-sm font-medium px-4 py-2 rounded-full border border-glacier/15 hover:border-red-300 hover:text-red-500 transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleConnectGmail}
                    className="text-sm font-medium px-4 py-2 rounded-full bg-glacier text-frost hover:brightness-110 transition"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>

            {/* Follow-up settings */}
            <div className="frosted rounded-2xl p-6">
              <p className="text-sm font-medium mb-1">Follow-up reminders</p>
              <p className="text-xs text-mist mb-3">
                How many days after sending should we remind you to follow up?
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={followupDays}
                  onChange={(e) => setFollowupDays(Number(e.target.value))}
                  className="w-20 border border-glacier/15 rounded-xl px-3 py-2 bg-white/70"
                />
                <span className="text-sm text-glacier/70">days</span>
                <button
                  onClick={saveFollowupDays}
                  className="ml-auto text-sm font-medium px-4 py-2 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
                >
                  Save
                </button>
                {savedMessage && (
                  <span className="text-xs text-green-600">{savedMessage}</span>
                )}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}