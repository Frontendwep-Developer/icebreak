"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabaseClient } from "@/lib/supabaseClient";

// Temporarily hidden — email change UX needs polish before launch.
// Set to true to re-enable the "Change" button below.
const SHOW_EMAIL_CHANGE = false;
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
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [followupDays, setFollowupDays] = useState(3);
  const [savedMessage, setSavedMessage] = useState("");

  // --- Change email ---
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  // --- Change password ---
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login");
        return;
      }
      setUserEmail(data.session.user.email || "");
      setAccessToken(data.session.access_token);
      setAuthChecked(true);
    });

    const { data: listener } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.push("/login");
          return;
        }
        setUserEmail(session.user.email || "");
        setAccessToken(session.access_token);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (accessToken) fetchAccount();
  }, [accessToken]);

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
  }

  async function handleSignOut() {
    await supabaseClient.auth.signOut();
    router.push("/login");
  }

  async function fetchAccount() {
    setLoading(true);
    try {
      const res = await fetch(`/api/account`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        setAccount(data);
        if (data.defaultFollowupDays) setFollowupDays(data.defaultFollowupDays);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleConnectGmail() {
    window.location.href = `/api/auth/google?email=${encodeURIComponent(userEmail)}`;
  }

  async function handleDisconnectGmail() {
    await fetch("/api/account", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action: "disconnect_gmail" }),
    });
    fetchAccount();
  }

  function handleUpgrade() {
    const baseUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL;
    const url = `${baseUrl}?checkout[email]=${encodeURIComponent(
      userEmail
    )}&checkout[custom][user_email]=${encodeURIComponent(userEmail)}`;
    window.location.href = url;
  }

  async function saveFollowupDays() {
    await fetch("/api/account", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ defaultFollowupDays: followupDays }),
    });
    setSavedMessage("Saved ✓");
    setTimeout(() => setSavedMessage(""), 2000);
  }

  async function saveEmailChange() {
    setEmailError("");
    setEmailMessage("");
    const trimmed = emailInput.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailError("Please enter a valid email");
      return;
    }
    setEmailSaving(true);
    try {
      const { error } = await supabaseClient.auth.updateUser({ email: trimmed });
      if (error) {
        setEmailError(error.message);
        return;
      }
      setEmailMessage(
        "Confirmation email sent — check your inbox (and the old address) to finish the change. Your plan, credits, and Gmail connection will move automatically once confirmed."
      );
      setEditingEmail(false);
    } finally {
      setEmailSaving(false);
    }
  }

  async function savePasswordChange() {
    setPasswordError("");
    setPasswordMessage("");
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError("Password must include at least one letter and one number");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }
    setPasswordSaving(true);
    try {
      const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message);
        return;
      }
      setPasswordMessage("Password updated ✓");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setPasswordSaving(false);
    }
  }

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

      <section className="max-w-2xl mx-auto px-6 pb-24">
        <h1 className="font-display text-3xl font-semibold mb-8">Account</h1>

        {/* Account email */}
        <div className="frosted rounded-2xl p-6 mb-4">
          <p className="text-xs text-mist mb-2">Signed in as</p>

          {SHOW_EMAIL_CHANGE && editingEmail ? (
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder={userEmail}
                className="flex-1 border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
                autoFocus
              />
              <button
                onClick={saveEmailChange}
                disabled={emailSaving}
                className="bg-thaw text-white font-medium px-4 py-2.5 rounded-full disabled:opacity-50"
              >
                {emailSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingEmail(false);
                  setEmailError("");
                }}
                className="border border-glacier/15 font-medium px-4 py-2.5 rounded-full"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="font-mono text-lg">{userEmail}</p>
              <div className="flex items-center gap-3">
                {SHOW_EMAIL_CHANGE && (
                  <button
                    onClick={() => {
                      setEmailInput(userEmail);
                      setEditingEmail(true);
                      setEmailMessage("");
                      setEmailError("");
                    }}
                    className="text-sm text-thaw underline"
                  >
                    Change
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  className="text-sm text-glacier/60 underline hover:text-red-500"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}

          {emailError && <p className="text-sm text-red-600 mt-2">{emailError}</p>}
          {emailMessage && (
            <p className="text-sm text-green-700 mt-2">{emailMessage}</p>
          )}

          <p className="text-xs text-mist mt-2">
            Your usage, plan, and Gmail connection are all tied to this
            account and will follow you automatically if you change your
            email.
          </p>
        </div>

        {/* Password */}
        <div className="frosted rounded-2xl p-6 mb-4">
          <p className="text-xs text-mist mb-2">Password</p>
          <div className="grid gap-3">
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 pr-16 bg-white/70"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mist hover:text-thaw"
              >
                {showNewPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-[11px] text-mist -mt-1">
              At least 8 characters, with a letter and a number.
            </p>
            <input
              type={showNewPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
            />
            {passwordError && (
              <p className="text-sm text-red-600">{passwordError}</p>
            )}
            {passwordMessage && (
              <p className="text-sm text-green-700">{passwordMessage}</p>
            )}
            <button
              onClick={savePasswordChange}
              disabled={passwordSaving || !newPassword}
              className="w-full border border-glacier/15 hover:border-thaw hover:text-thaw font-medium py-2.5 rounded-full transition-colors disabled:opacity-40 disabled:hover:border-glacier/15 disabled:hover:text-glacier"
            >
              {passwordSaving ? "Updating..." : "Update password"}
            </button>
          </div>
        </div>

        {!account && loading ? (
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