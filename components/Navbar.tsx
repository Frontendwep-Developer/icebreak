"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

export default function Navbar({ variant }: { variant: "landing" | "app" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [userPlan, setUserPlan] = useState<"free" | "pro" | null>(null);

  useEffect(() => {
    if (variant !== "app") return;
    supabaseClient.auth.getSession().then(({ data }) => {
      if (data.session?.user.email) setEmail(data.session.user.email);
      if (data.session?.access_token) {
        fetch("/api/account", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.plan) setUserPlan(d.plan);
          })
          .catch(() => {});
      }
    });
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

  async function handleSignOut() {
    await supabaseClient.auth.signOut();
    router.push("/login");
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
          <div className="flex items-center gap-4 pl-4 border-l border-glacier/10">
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
        </div>
      </nav>
    );
  }

  // variant === "app"
  const linkClass = (href: string) => {
    const isActive = pathname === href;
    return `text-sm font-medium px-4 py-2 rounded-full transition-colors ${
      isActive
        ? "bg-glacier text-frost"
        : "hover:bg-glacier/5 text-glacier/80"
    }`;
  };

  return (
    <nav className="max-w-4xl mx-auto flex items-center justify-between px-6 py-6">
      <a href="/tool" className="font-display font-semibold text-lg">
        ice<span className="text-thaw">break</span>
      </a>
      <div className="flex items-center gap-3">
        <a href="/tool" className={linkClass("/tool")}>
          Generate
        </a>
        <a href="/history" className={linkClass("/history")}>
          History
        </a>
        <a href="/profile" className={linkClass("/profile")}>
          Profile
        </a>
        {userPlan === "pro" ? (
          <span className="text-xs font-medium px-4 py-2 rounded-full bg-glacier/10 text-glacier/60">
            Pro ✓
          </span>
        ) : (
          <button
            onClick={handleUpgrade}
            className="text-sm font-medium px-4 py-2 rounded-full border border-thaw text-thaw hover:bg-thaw hover:text-white transition-colors"
          >
            Upgrade to Pro
          </button>
        )}
        <button
          onClick={handleSignOut}
          className="text-sm font-medium px-4 py-2 rounded-full border border-glacier/15 text-glacier/60 hover:border-red-300 hover:text-red-500 transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}