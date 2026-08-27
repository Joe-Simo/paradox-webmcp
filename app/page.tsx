import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";
import { LandingRift } from "@/components/paradox/landing-rift";
import { buttonVariants } from "@/components/ui/button";
import { computeGoldenPreview } from "@/paradox/explorer/golden-preview";

export default function HomePage() {
  const preview = computeGoldenPreview();
  return (
    <div className="landing-page">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="landing-nav">
        <span className="wordmark" translate="no">Paradox</span>
        <span>The correctness lab for the human-agent web</span>
        <div className="landing-nav-actions">
          <Link href="/docs">Docs</Link>
          <a href="https://github.com/Joe-Simo/paradox-webmcp" aria-label="Paradox on GitHub" title="GitHub" target="_blank" rel="noreferrer"><Github aria-hidden="true" /></a>
          <Link href="/lab/expense-approval/ledger">Open the lab <ArrowRight aria-hidden="true" /></Link>
        </div>
      </header>
      <main id="main-content" className="landing-main" tabIndex={-1}>
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="section-label">Model checking / Human + Agent / One live state</span>
            <h1>Explore every future<br />{" "}before your users do.</h1>
            <p>Humans and agents now share one live application. Paradox explores their interleavings and finds the shortest path to an invalid state.</p>
            <div className="hero-actions">
              <Link className={buttonVariants({ size: "lg" })} href="/lab/expense-approval/ledger">Run the race <ArrowRight aria-hidden="true" /></Link>
              <Link className="hero-text-link" href="/docs">How it works</Link>
            </div>
            <p className="hero-proof"><span>{preview.schedulesExplored} schedules</span><span>{preview.uniqueStatesReached} states</span><span>{preview.counterexamples} counterexamples</span><span>Computed, not scripted</span></p>
          </div>
          <LandingRift preview={preview} />
        </section>
        <section className="landing-statement" aria-labelledby="statement-title">
          <span className="section-label">Why Paradox</span>
          <h2 id="statement-title">Traditional tests check the human or the agent.<br />Paradox checks them together.</h2>
          <Link href="/docs">Install the instrumentation <ArrowRight aria-hidden="true" /></Link>
        </section>
      </main>
      <footer className="landing-footer">
        <span className="wordmark" translate="no">Paradox</span>
        <p>Bounded model checking for WebMCP products.</p>
        <nav aria-label="Footer navigation"><Link href="/docs">Docs</Link><a href="https://github.com/Joe-Simo/paradox-webmcp" target="_blank" rel="noreferrer">Source</a><a href="https://github.com/Joe-Simo/paradox-webmcp/blob/main/LICENSE" target="_blank" rel="noreferrer">AGPL-3.0</a></nav>
      </footer>
    </div>
  );
}
