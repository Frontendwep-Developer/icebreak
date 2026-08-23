"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabaseClient } from "@/lib/supabaseClient";

function passwordIssue(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[a-zA-Z]/.test(pw)) return "Password must include at least one letter";
  if (!/[0-9]/.test(pw)) return "Password must include at least one number";
  return null;
}

// Same helper as login/page.tsx — used here to immediately overwrite the
// signup-time throwaway password again, closing the window completely.
function generateThrowawayPassword() {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function ConfirmSignupContent() {
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
    // Clicking the confirmation link establishes a session automatically
    // (Supabase reads the token from the URL). The moment that happens, we
    // IMMEDIATELY overwrite the password with a new random value — before
    // showing anything to the user. This closes the gap completely: even
    // if the person who set the original signup password never comes back
    // to this page, or the real owner closes the tab without picking a
    // password of their own, the original (throwaway) password is already
    // dead and unusable by anyone.
    supabaseClient.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        try {
          const invalidator = generateThrowawayPassword();
          await supabaseClient.auth.updateUser({ password: invalidator });
        } catch {
          // Even if this fails, we still require setting a real password
          // below before letting them continue — non-fatal either way.
        }
      }
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
      <Navbar variant="minimal" />

      <section className="max-w-md mx-auto px-6 pt-16 pb-24">
        <div className="frosted rounded-2xl p-8">
          {checking ? (
            <p className="text-sm text-glacier/60">Loading...</p>
          ) : done ? (
            <>
              <h1 className="font-display text-2xl font-semibold mb-2">
                You're all set ✓
              </h1>
              <p className="text-sm text-glacier/60 mb-6">
                Your account is confirmed and your password is set.
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
                This confirmation link is invalid or has expired. Please
                sign up again.
              </p>
              <button
                onClick={() => router.push("/login?mode=signup")}
                className="w-full bg-thaw text-white font-medium py-3 rounded-full hover:brightness-105 transition"
              >
                Back to sign up
              </button>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold mb-1">
                Confirm your email
              </h1>
              <p className="text-sm text-glacier/60 mb-6">
                Almost done — set the password you'll use to log in.
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
                  placeholder="Confirm password"
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
                  {saving ? "Saving..." : "Set password & continue"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default function ConfirmSignupPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmSignupContent />
    </Suspense>
  );
}