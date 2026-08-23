"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabaseClient } from "@/lib/supabaseClient";

function passwordIssue(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[a-zA-Z]/.test(pw)) return "Password must include at least one letter";
  if (!/[0-9]/.test(pw)) return "Password must include at least one number";
  return null;
}

// Used only as a throwaway placeholder at signup — it's immediately
// invalidated again as soon as the confirmation link is opened, and the
// real password is set on /confirm-signup. Nobody ever needs to know or
// use this value.
function generateThrowawayPassword() {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  // --- Forgot password ---
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  async function handleContinue() {
    setError("");

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email");
      return;
    }

    if (mode === "signup") {
      if (!agreedToTerms) {
        setError("Please agree to the Terms of Service and Privacy Policy");
        return;
      }
    } else if (!password) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabaseClient.auth.signUp({
          email: email.trim(),
          // Never set by the person filling this form — see
          // generateThrowawayPassword() for why. The real password is
          // chosen on /confirm-signup, by whoever actually owns this inbox.
          password: generateThrowawayPassword(),
          options: {
            ...(name.trim() ? { data: { full_name: name.trim() } } : {}),
            emailRedirectTo: `${window.location.origin}/confirm-signup`,
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (data.session) {
          // Email confirmation is off — signed in immediately. Send them
          // to set a real password right away.
          router.push("/confirm-signup");
          return;
        }

        const isExistingAccount = (data.user?.identities?.length ?? 0) === 0;
        if (isExistingAccount) {
          setError(
            "This email is already registered — try logging in instead."
          );
          setMode("login");
          return;
        }

        setSignupDone(true);
        return;
      } else {
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setError(signInError.message);
          return;
        }
      }
      router.push("/tool");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setForgotError("");
    setForgotMessage("");
    if (!email.trim() || !email.includes("@")) {
      setForgotError("Enter your account email above first");
      return;
    }
    setForgotLoading(true);
    try {
      const { error: resetError } = await supabaseClient.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/reset-password` }
      );
      if (resetError) {
        setForgotError(resetError.message);
        return;
      }
      setForgotMessage("Check your inbox for a reset link.");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-frost">
      <Navbar variant="landing" />

      <section className="max-w-md mx-auto px-6 pt-16 pb-24">
        <div className="frosted rounded-2xl p-8">
          {signupDone ? (
            <>
              <h1 className="font-display text-2xl font-semibold mb-1">
                Check your email
              </h1>
              <p className="text-sm text-glacier/60 mb-6">
                We sent a confirmation link to <strong>{email}</strong>.
                Click it to set your password and finish creating your
                account.
              </p>
              <button
                onClick={() => {
                  setSignupDone(false);
                  setMode("login");
                }}
                className="w-full text-sm text-glacier/60 underline"
              >
                Back to log in
              </button>
            </>
          ) : (
            <>
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => {
                    setMode("login");
                    setForgotMode(false);
                  }}
                  className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
                    mode === "login"
                      ? "bg-glacier text-frost"
                      : "border border-glacier/15 text-glacier/70"
                  }`}
                >
                  Log in
                </button>
                <button
                  onClick={() => {
                    setMode("signup");
                    setForgotMode(false);
                  }}
                  className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
                    mode === "signup"
                      ? "bg-glacier text-frost"
                      : "border border-glacier/15 text-glacier/70"
                  }`}
                >
                  Sign up
                </button>
              </div>

              {forgotMode ? (
                <>
                  <h1 className="font-display text-2xl font-semibold mb-1">
                    Reset your password
                  </h1>
                  <p className="text-sm text-glacier/60 mb-6">
                    Enter your account email and we&apos;ll send you a reset link.
                  </p>
                  <div className="space-y-3">
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
                      className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
                    />
                    {forgotError && <p className="text-sm text-red-600">{forgotError}</p>}
                    {forgotMessage && (
                      <p className="text-sm text-green-700">{forgotMessage}</p>
                    )}
                    <button
                      onClick={handleForgotPassword}
                      disabled={forgotLoading}
                      className="w-full bg-thaw text-white font-medium py-3 rounded-full hover:brightness-105 transition disabled:opacity-50"
                    >
                      {forgotLoading ? "Sending..." : "Send reset link"}
                    </button>
                    <button
                      onClick={() => {
                        setForgotMode(false);
                        setForgotError("");
                        setForgotMessage("");
                      }}
                      className="w-full text-sm text-glacier/60 underline"
                    >
                      Back to log in
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="font-display text-2xl font-semibold mb-1">
                    {mode === "login" ? "Welcome back" : "Create your account"}
                  </h1>
                  <p className="text-sm text-glacier/60 mb-6">
                    {mode === "login"
                      ? "Enter your email and password to continue."
                      : "We'll email you a link to set your password and get started."}
                  </p>

                  <div className="space-y-3">
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleContinue()}
                      className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
                    />

                    {mode === "login" && (
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleContinue()}
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
                    )}

                    {mode === "signup" && (
                      <>
                        <input
                          type="text"
                          placeholder="Your name (optional, used to sign your emails)"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleContinue()}
                          className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
                        />
                        <label className="flex items-start gap-2 text-xs text-glacier/70 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            I agree to the{" "}
                            <a
                              href="/terms"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-thaw underline"
                            >
                              Terms of Service
                            </a>{" "}
                            and{" "}
                            <a
                              href="/privacy"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-thaw underline"
                            >
                              Privacy Policy
                            </a>
                          </span>
                        </label>
                      </>
                    )}

                    {mode === "login" && (
                      <div className="text-right -mt-1">
                        <button
                          onClick={() => {
                            setForgotMode(true);
                            setError("");
                          }}
                          className="text-xs text-thaw underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <button
                      onClick={handleContinue}
                      disabled={loading}
                      className="w-full bg-thaw text-white font-medium py-3 rounded-full hover:brightness-105 transition disabled:opacity-50"
                    >
                      {loading
                        ? "Please wait..."
                        : mode === "login"
                        ? "Log in"
                        : "Sign up"}
                    </button>
                  </div>

                  <p className="text-xs text-mist mt-6 text-center">
                    {mode === "login" ? (
                      <>
                        New here?{" "}
                        <button
                          onClick={() => setMode("signup")}
                          className="text-thaw underline"
                        >
                          Sign up
                        </button>
                      </>
                    ) : (
                      <>
                        Already have an account?{" "}
                        <button
                          onClick={() => setMode("login")}
                          className="text-thaw underline"
                        >
                          Log in
                        </button>
                      </>
                    )}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}