"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabaseClient } from "@/lib/supabaseClient";

function passwordIssue(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[a-zA-Z]/.test(pw)) return "Password must include at least one letter";
  if (!/[0-9]/.test(pw)) return "Password must include at least one number";
  return null;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The recovery link, when clicked, makes Supabase establish a session
    // on this page automatically (it reads the token from the URL). We
    // just need to wait a moment for that to happen, then check for it.
    supabaseClient.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setChecking(false);
    });

    const { data: listener } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        setHasSession(!!session);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSave() {
    setError("");
    const issue = passwordIssue(password);
    if (issue) {
      setError(issue);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabaseClient.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-frost">
      <Navbar variant="landing" />

      <section className="max-w-md mx-auto px-6 pt-16 pb-24">
        <div className="frosted rounded-2xl p-8">
          {checking ? (
            <p className="text-sm text-glacier/60">Loading...</p>
          ) : done ? (
            <>
              <h1 className="font-display text-2xl font-semibold mb-2">
                Password updated ✓
              </h1>
              <p className="text-sm text-glacier/60 mb-6">
                You can now use your new password to log in.
              </p>
              <button
                onClick={() => router.push("/tool")}
                className="w-full bg-thaw text-white font-medium py-3 rounded-full hover:brightness-105 transition"
              >
                Go to app
              </button>
            </>
          ) : !hasSession ? (
            <>
              <h1 className="font-display text-2xl font-semibold mb-2">
                Link expired
              </h1>
              <p className="text-sm text-glacier/60 mb-6">
                This reset link is invalid or has expired. Please request a
                new one.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="w-full bg-thaw text-white font-medium py-3 rounded-full hover:brightness-105 transition"
              >
                Back to log in
              </button>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold mb-1">
                Set a new password
              </h1>
              <p className="text-sm text-glacier/60 mb-6">
                Choose a new password for your account.
              </p>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 pr-16 bg-white/70"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mist hover:text-thaw"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="text-[11px] text-mist -mt-1">
                  At least 8 characters, with a letter and a number.
                </p>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-thaw text-white font-medium py-3 rounded-full hover:brightness-105 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save new password"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}