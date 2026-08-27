import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI-Powered Criminal Network Analysis System (PS26189)",
  description: "Evidence-grounded investigative intelligence workspace for criminal network analysis, entity resolution, and temporal graphing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen text-zinc-100 bg-zinc-950">
        {children}
      </body>
    </html>
  );
}
