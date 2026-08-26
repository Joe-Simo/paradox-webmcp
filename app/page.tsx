import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingRift } from "@/components/paradox/landing-rift";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="landing-page">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="landing-nav">
        <span className="wordmark" translate="no">Paradox</span>
        <span>The correctness lab for the human-agent web</span>
        <Link href="/lab/expense-approval/ledger">Open the lab <ArrowRight aria-hidden="true" /></Link>
      </header>
      <main id="main-content" className="landing-main" tabIndex={-1}>
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="section-label">Human + Agent / One live state</span>
            <h1>Explore every future<br />{" "}before your users do.</h1>
            <p>Humans and AI agents now operate the same application at the same time. Paradox finds the invalid states created between what an agent reads and what the system eventually commits.</p>
            <Link className={buttonVariants({ size: "lg" })} href="/lab/expense-approval/ledger">Run the expense race <ArrowRight aria-hidden="true" /></Link>
          </div>
          <LandingRift />
        </section>
        <section className="landing-thesis" aria-label="What Paradox tests">
          <article><span>01 / Human</span><p>Traditional tests ask whether a human can use the application correctly.</p></article>
          <article><span>02 / Agent</span><p>Agent evaluations ask whether an agent can use the application correctly.</p></article>
          <article className="thesis-paradox"><span>03 / Together</span><p>Paradox asks whether both can use it correctly at the same time.</p></article>
        </section>
      </main>
    </div>
  );
}
