import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Terms of Service — Icebreak",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-frost">
      <Navbar variant="landing" />
      <section className="max-w-3xl mx-auto px-6 pt-12 pb-24">
        <h1 className="font-display text-3xl font-semibold mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-mist mb-10">Last updated: August 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-glacier/90">
          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              1. Agreement to Terms
            </h2>
            <p>
              These Terms of Service (&quot;Terms&quot;) govern your access to and
              use of Icebreak (&quot;the Service&quot;, &quot;we&quot;, &quot;us&quot;), a tool that
              helps generate personalized outreach emails using AI. By
              creating an account or using the Service, you agree to be
              bound by these Terms. If you do not agree, do not use the
              Service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              2. Who Can Use Icebreak
            </h2>
            <p>
              You must be at least 18 years old and able to form a binding
              contract to use the Service. You are responsible for keeping
              your account credentials secure and for all activity that
              happens under your account.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              3. What the Service Does
            </h2>
            <p>
              Icebreak lets you input or upload lead information and
              generates draft outreach email content using AI. Generated
              content is a starting point — you are responsible for
              reviewing, editing, and approving any message before it is
              sent to a third party. We do not guarantee the accuracy,
              deliverability, or performance of any generated content.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              4. Your Responsibilities — Acceptable Use
            </h2>
            <p className="mb-2">
              You are solely responsible for how you use content generated
              by the Service, including any emails you send using it. By
              using Icebreak, you agree that you will:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Comply with all applicable laws regarding unsolicited
                commercial email, including but not limited to CAN-SPAM
                (US), CASL (Canada), and GDPR/PECR (EU/UK) where applicable
                to your outreach;
              </li>
              <li>
                Only email recipients you have a lawful basis to contact,
                and honor opt-out/unsubscribe requests promptly;
              </li>
              <li>
                Not use the Service to generate content that is fraudulent,
                deceptive, harassing, defamatory, or otherwise unlawful;
              </li>
              <li>
                Not attempt to interfere with, overload, or gain
                unauthorized access to the Service or other users&apos;
                accounts;
              </li>
              <li>
                Not use the Service to impersonate any person or entity, or
                to misrepresent your affiliation with a person or entity.
              </li>
            </ul>
            <p className="mt-2">
              We may suspend or terminate accounts that we reasonably
              believe violate this section, without prior notice.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              5. Third-Party Services
            </h2>
            <p>
              Icebreak relies on third-party providers to operate, including
              (but not limited to) AI processing providers, our database
              and authentication provider, our payment processor, and, if
              you choose to connect it, Google&apos;s Gmail API. Your use of
              those integrations is also subject to the relevant
              third-party&apos;s own terms. We are not responsible for the
              availability or behavior of third-party services outside our
              control.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              6. Plans, Billing &amp; Cancellation
            </h2>
            <p>
              Icebreak offers a free plan with limited monthly usage and a
              paid &quot;Pro&quot; subscription plan. Paid subscriptions are billed
              in advance on a recurring basis through our payment processor
              (Lemon Squeezy), which acts as the merchant of record for
              your purchase. You may cancel your subscription at any time;
              cancellation takes effect at the end of the current billing
              period. Fees already paid are non-refundable except where
              required by law.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              7. Gmail Integration
            </h2>
            <p>
              If you choose to connect your Gmail account, Icebreak will
              request permission to create draft emails on your behalf. We
              do not read your existing emails or send messages without
              your explicit action. You can disconnect this access at any
              time from your account settings, or directly through your
              Google Account permissions.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              8. Intellectual Property
            </h2>
            <p>
              You retain ownership of the lead data and context you provide,
              and of the final, edited email content you choose to send.
              We retain ownership of the Service itself, including its
              software, design, and underlying technology.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              9. Disclaimer of Warranties
            </h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available&quot;, without
              warranties of any kind, express or implied, including
              warranties of merchantability, fitness for a particular
              purpose, or non-infringement. We do not warrant that the
              Service will be uninterrupted, error-free, or that
              AI-generated content will be accurate or appropriate for
              every context.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              10. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, Icebreak and its
              operator shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, or any loss of
              profits or revenue, arising from your use of the Service,
              including any content you send using it. Our total liability
              for any claim arising from these Terms or the Service shall
              not exceed the amount you paid us in the 3 months preceding
              the claim.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              11. Changes to the Service or Terms
            </h2>
            <p>
              We may modify or discontinue the Service, or update these
              Terms, at any time. If we make material changes, we will make
              reasonable efforts to notify you (e.g. by email or an
              in-app notice). Continued use of the Service after changes
              take effect constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              12. Termination
            </h2>
            <p>
              You may stop using the Service and delete your account at any
              time. We may suspend or terminate your access if you violate
              these Terms or if required by law.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-2">
              13. Contact
            </h2>
            <p>
              Questions about these Terms can be sent to{" "}
              <a
                href="mailto:support@icebreak-livid.vercel.app"
                className="text-thaw underline"
              >
                [your support email]
              </a>
              .
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}