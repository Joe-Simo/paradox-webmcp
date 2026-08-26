import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://paradox-webmcp.vercel.app"),
  title: {
    default: "Paradox — WebMCP Correctness Lab",
    template: "%s — Paradox",
  },
  description: "Paradox explores bounded human-agent WebMCP interleavings, finds replayable business-invariant violations, and verifies semantic guards.",
  applicationName: "Paradox",
  keywords: ["WebMCP", "model checking", "agent evaluation", "concurrency testing", "semantic instrumentation"],
  authors: [{ name: "Joe Simo", url: "https://github.com/Joe-Simo" }],
  creator: "Joe Simo",
  category: "developer tools",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "Paradox — Explore every future before your users do",
    description: "The bounded correctness lab for humans and WebMCP agents operating one live application.",
    siteName: "Paradox",
  },
  twitter: {
    card: "summary_large_image",
    title: "Paradox — WebMCP Correctness Lab",
    description: "Explore the dangerous futures created when humans and agents use the same application.",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
