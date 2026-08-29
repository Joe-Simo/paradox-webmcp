import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.paradoxwebmcp.com"),
  title: {
    default: "Paradox — Testing Tool for WebMCP Apps",
    template: "%s — Paradox",
  },
  description: "Paradox is a testing tool for WebMCP apps: it explores every human-agent interleaving of your live state, finds replayable invariant violations, and proves the repair.",
  applicationName: "Paradox",
  keywords: ["WebMCP", "model checking", "agent evaluation", "concurrency testing", "semantic instrumentation"],
  authors: [{ name: "Joe Simo", url: "https://github.com/Joe-Simo" }],
  creator: "Joe Simo",
  category: "developer tools",
  openGraph: {
    type: "website",
    title: "Paradox — Explore every future before your users do",
    description: "A testing tool for WebMCP apps: bounded exploration of every human-agent interleaving, with a proven repair.",
    siteName: "Paradox",
  },
  twitter: {
    card: "summary_large_image",
    title: "Paradox — Testing Tool for WebMCP Apps",
    description: "Find the race a human and an agent ship together — and prove the fix against every explored future.",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#04060c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
