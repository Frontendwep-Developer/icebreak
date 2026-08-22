"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function RedirectContent() {
  const searchParams = useSearchParams();
  const [mailtoLink, setMailtoLink] = useState("");

  useEffect(() => {
    const to = searchParams.get("to");
    // searchParams.get() already URL-decodes the value — decoding it again
    // here corrupts mailto links that contain "%" (from encoded subject/body),
    // which silently breaks the redirect.
    if (to) {
      setMailtoLink(to);
      // Try automatically first — works in some browsers (e.g. Firefox).
      window.location.href = to;
    }
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-frost flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-glacier/50">Opening your email app…</p>
      {mailtoLink && (
        <>
          <p className="text-xs text-mist">
            Please wait a moment — if your email app doesn't open
            automatically, click below:
          </p>
          <a
            href={mailtoLink}
            className="bg-thaw text-white font-medium px-6 py-3 rounded-full hover:brightness-105 transition"
          >
            Open email app →
          </a>
        </>
      )}
    </main>
  );
}

export default function MailtoRedirectPage() {
  return (
    <Suspense fallback={null}>
      <RedirectContent />
    </Suspense>
  );
}