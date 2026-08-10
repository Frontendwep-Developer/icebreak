import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-frost">
      {/* Nav */}
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-6">
        <span className="font-display font-semibold text-lg tracking-tight">
          ice<span className="text-thaw">break</span>
        </span>
        <Link
          href="/tool"
          className="text-sm font-medium px-4 py-2 rounded-full border border-glacier/15 hover:border-thaw hover:text-thaw transition-colors"
        >
          Try it free →
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-mist mb-4">
            for founders, agencies &amp; SDRs
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight">
            Cold emails that don&apos;t{" "}
            <span className="thaw-underline">sound cold.</span>
          </h1>
          <p className="mt-6 text-lg text-glacier/70 max-w-md">
            Paste a list of leads. Icebreak reads each company and writes a
            genuinely personal opening line and email — in seconds, not
            hours.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link
              href="/tool"
              className="bg-thaw text-white font-medium px-6 py-3 rounded-full hover:brightness-105 transition"
            >
              Generate my first batch
            </Link>
            <span className="text-sm text-mist">
              10 free emails · no card required
            </span>
          </div>
        </div>

        {/* Signature visual: frozen template -> thawed personalized email */}
        <div className="relative">
          <div className="grid grid-cols-2 gap-4">
            <div className="frosted rounded-2xl p-5 opacity-70">
              <p className="font-mono text-[10px] text-mist mb-3">
                GENERIC TEMPLATE
              </p>
              <div className="space-y-2">
                <div className="h-2.5 bg-glacier/10 rounded w-5/6" />
                <div className="h-2.5 bg-glacier/10 rounded w-full" />
                <div className="h-2.5 bg-glacier/10 rounded w-4/6" />
                <div className="h-2.5 bg-glacier/10 rounded w-full" />
                <div className="h-2.5 bg-glacier/10 rounded w-3/6" />
              </div>
              <p className="mt-4 text-xs text-mist italic">
                &ldquo;Hi there, I wanted to reach out...&rdquo;
              </p>
            </div>
            <div className="rounded-2xl p-5 bg-white shadow-[0_8px_30px_rgba(255,122,69,0.15)] border border-thaw/20">
              <p className="font-mono text-[10px] text-thaw mb-3">
                ICEBREAK OUTPUT
              </p>
              <div className="space-y-2">
                <div className="h-2.5 bg-thaw/20 rounded w-full" />
                <div className="h-2.5 bg-glacier/10 rounded w-5/6" />
                <div className="h-2.5 bg-glacier/10 rounded w-full" />
                <div className="h-2.5 bg-glacier/10 rounded w-4/6" />
              </div>
              <p className="mt-4 text-xs text-glacier/80 italic">
                &ldquo;Saw Acme just opened a Berlin office — congrats...&rdquo;
              </p>
            </div>
          </div>
          <p className="text-center text-xs font-mono text-mist mt-3">
            same lead, same product · one gets replies
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-glacier/10">
        <h2 className="font-display text-2xl font-semibold mb-10">
          How it works
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              t: "Paste your leads",
              d: "Name, company, and a link or note about each — CSV or plain text, no formatting fuss.",
            },
            {
              t: "Icebreak reads &amp; writes",
              d: "The model reads what you gave it about each lead and drafts an opener plus a full email in your voice.",
            },
            {
              t: "Review & send",
              d: "Copy into your inbox or export as CSV for your existing outreach tool.",
            },
          ].map((s, i) => (
            <div key={i}>
              <p className="font-mono text-thaw text-sm mb-2">
                0{i + 1}
              </p>
              <h3
                className="font-display font-semibold mb-2"
                dangerouslySetInnerHTML={{ __html: s.t }}
              />
              <p className="text-sm text-glacier/70">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-glacier/10">
        <h2 className="font-display text-2xl font-semibold mb-10">
          Simple pricing
        </h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-2xl">
          <div className="frosted rounded-2xl p-8">
            <p className="font-mono text-xs text-mist uppercase mb-2">
              Free
            </p>
            <p className="font-display text-3xl font-semibold mb-4">$0</p>
            <p className="text-sm text-glacier/70 mb-6">
              10 personalized emails per month. Enough to test on your next
              batch of leads.
            </p>
            <Link
              href="/tool"
              className="block text-center border border-glacier/20 rounded-full py-2.5 font-medium hover:border-thaw transition"
            >
              Start free
            </Link>
          </div>
          <div className="rounded-2xl p-8 bg-glacier text-frost">
            <p className="font-mono text-xs text-ice uppercase mb-2">Pro</p>
            <p className="font-display text-3xl font-semibold mb-4">
              $19<span className="text-base font-normal">/mo</span>
            </p>
            <p className="text-sm text-frost/70 mb-6">
              500 personalized emails per month, CSV export, and priority
              generation.
            </p>
            <a
              href={process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL}
              className="block text-center bg-thaw rounded-full py-2.5 font-medium hover:brightness-105 transition"
            >
              Upgrade to Pro
            </a>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-10 text-xs text-mist border-t border-glacier/10">
        © {new Date().getFullYear()} Icebreak.
      </footer>
    </main>
  );
}
