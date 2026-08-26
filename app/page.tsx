import Link from "next/link";
import { ArrowRight, Circle, Diamond, Orbit } from "lucide-react";

export default function HomePage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <span className="wordmark">Paradox</span>
        <span>The correctness lab for the human-agent web</span>
        <Link href="/lab/expense-approval/ledger">Open the lab <ArrowRight /></Link>
      </header>
      <section className="landing-hero">
        <div className="hero-copy">
          <h1>Explore every future<br />before your users do.</h1>
          <p>Humans and AI agents now operate the same application at the same time. Paradox finds the invalid states created between what an agent reads and what the system eventually commits.</p>
          <Link className="button-link" href="/lab/expense-approval/ledger">Run the expense race <ArrowRight /></Link>
        </div>
        <div className="hero-diagram" aria-label="A human-agent concurrency sequence">
          <div className="hero-state state-belief"><Circle /><span>Agent inspects</span><strong>$2,399 · v7</strong></div>
          <div className="hero-path path-one" />
          <div className="hero-state state-change"><Orbit /><span>Human changes</span><strong>$23,999 · v8</strong></div>
          <div className="hero-path path-two" />
          <div className="hero-state state-commit"><Diamond /><span>System commits</span><strong>Approved · v8</strong></div>
          <div className="hero-divergence">Invariant violated</div>
        </div>
      </section>
      <section className="landing-thesis">
        <span>Traditional testing asks whether a human can use an application correctly.</span>
        <span>Agent evaluation asks whether an agent can use an application correctly.</span>
        <strong>Paradox asks whether they can use it correctly at the same time.</strong>
      </section>
    </main>
  );
}
