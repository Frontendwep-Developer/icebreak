import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";

export const metadata = {
  title: "Icebreak — Cold emails that don't sound cold",
  description:
    "Turn a list of leads into personalized, warm outreach emails in seconds — powered by AI.",
};

const GA_MEASUREMENT_ID = "G-NEESQZ2XX7";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-body antialiased">
        {children}
        <Analytics />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}