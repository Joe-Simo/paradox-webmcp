import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppRuntime } from "@/components/runtime/app-runtime";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paradox — Explore every future",
  description: "The correctness lab for the human-agent web.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body><AppRuntime>{children}</AppRuntime></body>
    </html>
  );
}
