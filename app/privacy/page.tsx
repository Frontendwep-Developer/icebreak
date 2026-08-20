import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Privacy Policy — Icebreak",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-frost">
      <Navbar variant="landing" />
      <section className="max-w-3xl mx-auto px-6 pt-12 pb-24">
        <h1 className="font-display text-3xl font-semibold mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-mist mb-10">Last updated: August 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-glacier/90">
          <section>
            <p>
              This Privacy Policy explains what information Icebreak
              (&quot;we&quot;, &quot;us&quot;) collects, how we use it, and the choices you
              have. By using Icebreak, you agree to the collection and use
              of information as described here.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              1. Information We Collect
            </h2>
            <p className="mb-2 font-medium">Account information</p>
            <p className="mb-3">
              Your email address and password (securely hashed by our
              authentication provider — we never see or store your raw
              password).
            </p>
            <p className="mb-2 font-medium">Content you provide</p>
            <p className="mb-3">
              Lead information you enter or upload (names, companies,
              context notes, email addresses), sender details you provide
              (name, product description), and the email content you edit
              or generate.
            </p>
            <p className="mb-2 font-medium">Gmail data (only if you connect it)</p>
            <p className="mb-3">
              If you choose to connect your Gmail account, we store an
              access credential that lets us create draft emails in your
              mailbox on your behalf. We only use this to create drafts you
              explicitly request — we do not read your inbox or send email
              without your action.
            </p>
            <p className="mb-2 font-medium">Usage &amp; billing data</p>
            <p>
              How many emails you generate, your plan (Free/Pro), and
              billing information handled by our payment processor (Lemon
              Squeezy) — we do not store your full card details ourselves.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              2. How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To operate and provide the Service, including generating email content;</li>
              <li>To process payments and manage your subscription;</li>
              <li>To create Gmail drafts and follow-up reminders, if you&apos;ve connected Gmail;</li>
              <li>To communicate with you about your account or the Service;</li>
              <li>To maintain security, prevent abuse, and enforce our Terms of Service;</li>
              <li>To improve the Service (e.g. understanding aggregate, non-identifying usage patterns).</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              3. AI Processing
            </h2>
            <p>
              To generate email content, the information you provide about
              a lead and your product is sent to a third-party AI
              processing provider for the sole purpose of generating that
              content. This data is processed to produce your requested
              output and is not used by us to train shared AI models.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              4. Third Parties We Use
            </h2>
            <p className="mb-2">
              We rely on the following categories of service providers to
              operate Icebreak. Each processes data only as needed to
              provide their service to us:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Database &amp; authentication hosting</li>
              <li>AI text generation processing</li>
              <li>Payment processing and subscription billing</li>
              <li>Application hosting/infrastructure</li>
              <li>Google (Gmail API), only if you choose to connect your account</li>
            </ul>
            <p className="mt-2">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              5. Data Retention
            </h2>
            <p>
              We retain your account information and generated content for
              as long as your account is active, so you can access your
              history and usage. If you delete your account, we will
              delete or anonymize your personal data within a reasonable
              period, except where we&apos;re required to retain records for
              legal or accounting purposes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              6. Your Rights &amp; Choices
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You can edit your account details, or change your password, in Settings;</li>
              <li>You can disconnect Gmail access at any time;</li>
              <li>You can request a copy of, or the deletion of, your personal data by contacting us;</li>
              <li>If you are in the EU/UK, you have additional rights under GDPR, including the right to object to or restrict certain processing.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              7. Security
            </h2>
            <p>
              We use industry-standard measures (including encrypted
              connections, hashed passwords, and access-controlled APIs) to
              protect your information. No system is 100% secure, and we
              cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              8. Children&apos;s Privacy
            </h2>
            <p>
              Icebreak is not directed at anyone under 18, and we do not
              knowingly collect information from children.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. If we
              make material changes, we will make reasonable efforts to
              notify you (e.g. by email or an in-app notice).
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              10. Contact
            </h2>
            <p>
              Questions about this Privacy Policy or your data can be sent
              to{" "}
              <a
                href="mailto:icebreak.support@gmail.com"
  className="text-thaw underline"
>
  icebreak.support@gmail.com
</a>
              .
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}