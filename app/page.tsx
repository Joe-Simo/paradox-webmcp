import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";
import { Observatory } from "@/components/observatory/observatory";
import { AppRuntime } from "@/components/runtime/app-runtime";
import { computeGoldenPreview } from "@/paradox/explorer/golden-preview";

export default function HomePage() {
  const preview = computeGoldenPreview();
  return (
    <AppRuntime>
    <div className="landing-page">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="observatory-shell">
        <header className="landing-nav">
          <span className="wordmark" translate="no">Paradox</span>
          <div className="landing-nav-actions">
            <Link href="/docs">Docs</Link>
            <a href="https://github.com/Joe-Simo/paradox-webmcp" aria-label="Paradox on GitHub" title="GitHub" target="_blank" rel="noreferrer"><Github aria-hidden="true" /></a>
          </div>
        </header>
        <main id="main-content" className="landing-main" tabIndex={-1}>
          <Observatory preview={preview} />
        </main>
      </div>
      <section className="landing-statement" aria-labelledby="statement-title">
        <span className="section-label">Why you need this</span>
        <h2 id="statement-title">Explore every future<br />before your users do.</h2>
        <p className="statement-sub">Playwright tests your pages. Unit tests check your functions. Paradox tests what happens when a human and an AI agent act on the same live state at the same time — because that race ships in carts, bookings, refunds, and permissions.</p>
        <p className="hero-proof"><span>{preview.schedulesExplored} schedules</span><span>{preview.uniqueStatesReached} states</span><span>{preview.counterexamples} counterexamples</span><span>Computed, not scripted</span></p>
        <Link href="/docs">Install the instrumentation <ArrowRight aria-hidden="true" /></Link>
      </section>
      <footer className="landing-footer">
        <span className="wordmark" translate="no">Paradox</span>
        <p>Bounded model checking for WebMCP products.</p>
        <nav aria-label="Footer navigation"><Link href="/docs">Docs</Link><a href="https://github.com/Joe-Simo/paradox-webmcp" target="_blank" rel="noreferrer">Source</a><a href="https://github.com/Joe-Simo/paradox-webmcp/blob/main/LICENSE" target="_blank" rel="noreferrer">AGPL-3.0</a></nav>
      </footer>
    </div>
    </AppRuntime>
  );
}
