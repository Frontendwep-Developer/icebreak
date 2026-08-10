import "./globals.css";

export const metadata = {
  title: "Icebreak — Cold emails that don't sound cold",
  description:
    "Turn a list of leads into personalized, warm outreach emails in seconds — powered by AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
