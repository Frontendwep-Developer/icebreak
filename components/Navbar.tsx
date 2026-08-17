"use client";

import { useState, useEffect } from "react";

export default function Navbar({ variant }: { variant: "landing" | "app" }) {
  const [email, setEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

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
        <div className="flex items-center gap-6">
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
            href="/tool"
            className="bg-thaw text-white text-sm font-medium px-5 py-2.5 rounded-full hover:brightness-105 transition"
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
        {email && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full bg-glacier text-frost text-xs font-medium flex items-center justify-center"
            >
              {email[0].toUpperCase()}
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white border border-glacier/10 rounded-xl shadow-lg z-40 p-2">
                  <p className="px-3 py-2 text-xs text-mist font-mono truncate">
                    {email}
                  </p>
                  <a
                    href="/profile"
                    className="block px-3 py-2 text-sm rounded-lg hover:bg-glacier/5"
                  >
                    Profile & settings
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}