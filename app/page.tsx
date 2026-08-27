import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";
import { Observatory } from "@/components/observatory/observatory";
import { computeGoldenPreview } from "@/paradox/explorer/golden-preview";

export default function HomePage() {
  const preview = computeGoldenPreview();
  return (
    <div className="landing-page">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="observatory-shell">
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
          <Observatory preview={preview} />
        </main>
      </div>
      <section className="landing-acts" aria-labelledby="acts-title">
        <span className="section-label">How it works</span>
        <h2 id="acts-title">Four acts, sixty seconds.</h2>
        <div className="acts-grid">
          <article>
            <span className="act-index">01</span>
            <h3>Record</h3>
            <p>Play both operators: inspect as the agent from ChatGPT, change the amount as the human, then complete the stale review. Every semantic operation is recorded.</p>
            <p className="act-tools"><code>inspect_expense</code><code>approve_reviewed_expense</code></p>
          </article>
          <article>
            <span className="act-index">02</span>
            <h3>Explore</h3>
            <p>A bounded model checker interleaves the recorded human and agent operations, merges equivalent states, and evaluates every commit against business invariants.</p>
            <p className="act-tools"><code>explore_futures</code></p>
          </article>
          <article>
            <span className="act-index">03</span>
            <h3>Repair</h3>
            <p>The failing schedule is minimized to three essential operations, then a semantic version guard is applied to the approval implementation.</p>
            <p className="act-tools"><code>inspect_counterexample</code><code>apply_version_guard</code></p>
          </article>
          <article>
            <span className="act-index">04</span>
            <h3>Verify</h3>
            <p>The exact counterexample replays as blocked with <code>STATE_CHANGED</code>, and the full bounded state space re-explores to zero counterexamples.</p>
            <p className="act-tools"><code>verify_repair</code></p>
          </article>
        </div>
      </section>
      <section className="landing-statement" aria-labelledby="statement-title">
        <span className="section-label">Why Paradox</span>
        <h2 id="statement-title">Traditional tests check the human or the agent.<br />Paradox checks them together.</h2>
        <Link href="/docs">Install the instrumentation <ArrowRight aria-hidden="true" /></Link>
      </section>
      <footer className="landing-footer">
        <span className="wordmark" translate="no">Paradox</span>
        <p>Bounded model checking for WebMCP products.</p>
        <nav aria-label="Footer navigation"><Link href="/docs">Docs</Link><a href="https://github.com/Joe-Simo/paradox-webmcp" target="_blank" rel="noreferrer">Source</a><a href="https://github.com/Joe-Simo/paradox-webmcp/blob/main/LICENSE" target="_blank" rel="noreferrer">AGPL-3.0</a></nav>
      </footer>
    </div>
  );
}
