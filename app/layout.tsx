import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NETRA — Network Intelligence & Evidence Analysis",
  description: "Evidence-grounded investigative intelligence workspace for criminal network analysis, entity resolution, and temporal graphing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen text-slate-800 bg-[#F8FAFC]">
        {children}
      </body>
    </html>
  );
}
