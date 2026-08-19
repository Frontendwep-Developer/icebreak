"use client";

import { useState, useEffect } from "react";

export default function Navbar({ variant }: { variant: "landing" | "app" }) {
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (variant !== "app") return;
    try {
      const saved = localStorage.getItem("icebreak_template");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setEmail(parsed.email);
      }
    } catch {
      // ignore
    }
  }, [variant]);

  function handleUpgrade() {
    const baseUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL;
    const url = email
      ? `${baseUrl}?checkout[email]=${encodeURIComponent(
          email
        )}&checkout[custom][user_email]=${encodeURIComponent(email)}`
      : baseUrl;
    window.location.href = url as string;
  }

  if (variant === "landing") {
    return (
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-6">
        <a
          href="/"
          className="font-display font-semibold text-lg tracking-tight"
        >
          ice<span className="text-thaw">break</span>
        </a>
        <div className="flex items-center gap-5">
          <a
            href="/#how-it-works"
            className="hidden sm:inline text-sm text-glacier/70 hover:text-thaw transition-colors"
          >
            Features
          </a>
          <a
            href="/#pricing"
            className="hidden sm:inline text-sm text-glacier/70 hover:text-thaw transition-colors"
          >
            Pricing
          </a>
          <a
            href="/login"
            className="text-sm text-glacier/70 hover:text-thaw transition-colors"
          >
            Log in
          </a>
          <a
            href="/login?mode=signup"
            className="bg-thaw text-white text-sm font-medium px-6 py-2.5 rounded-full whitespace-nowrap hover:brightness-105 transition"
          >
            Get started →
          </a>
        </div>
      </nav>
    );
  }

  // variant === "app"
  return (
    <nav className="max-w-4xl mx-auto flex items-center justify-between px-6 py-6">
      <a href="/tool" className="font-display font-semibold text-lg">
        ice<span className="text-thaw">break</span>
      </a>
      <div className="flex items-center gap-3">
        <a
          href="/tool"
          className="text-sm font-medium px-4 py-2 rounded-full hover:bg-glacier/5 transition-colors"
        >
          Generate
        </a>
        <a
          href="/profile"
          className="text-sm font-medium px-4 py-2 rounded-full hover:bg-glacier/5 transition-colors"
        >
          Profile
        </a>
        <button
          onClick={handleUpgrade}
          className="text-sm font-medium px-4 py-2 rounded-full border border-thaw text-thaw hover:bg-thaw hover:text-white transition-colors"
        >
          Upgrade to Pro
        </button>
      </div>
    </nav>
  );
}