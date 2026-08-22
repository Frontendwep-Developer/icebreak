"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";

const SUPPORT_EMAIL = "icebreak.support@gmail.com";

export default function SupportPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  function handleSend() {
    const finalSubject = subject.trim() || "Icebreak Support";
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      finalSubject
    )}&body=${encodeURIComponent(message)}`;
    // See tool_page.tsx openMailto() for why we go through our own
    // redirect page instead of opening mailto: directly in a new tab.
    window.open(
      `/mailto-redirect?to=${encodeURIComponent(mailto)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function copyEmail() {
    navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen bg-frost">
      <Navbar variant="landing" />

      <section className="max-w-lg mx-auto px-6 pt-12 pb-24">
        <h1 className="font-display text-3xl font-semibold mb-2">
          Contact support
        </h1>
        <p className="text-glacier/70 mb-8">
          Have a question, ran into a bug, or want to request a feature?
          Write it below — it'll open in your email app, ready to send.
        </p>

        <div className="frosted rounded-2xl p-6 space-y-4">
          <input
            type="text"
            placeholder="Subject (optional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
          />
          <textarea
            placeholder="What's going on?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="w-full border border-glacier/15 rounded-xl px-4 py-2.5 bg-white/70"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="w-full bg-thaw text-white font-medium py-3 rounded-full hover:brightness-105 transition disabled:opacity-50"
          >
            Open in email app
          </button>
        </div>

        <p className="text-xs text-mist mt-6 text-center">
          Or email us directly at{" "}
          <button onClick={copyEmail} className="text-thaw underline">
            {copied ? "Copied ✓" : SUPPORT_EMAIL}
          </button>
        </p>
      </section>
    </main>
  );
}