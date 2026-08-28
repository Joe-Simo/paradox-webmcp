import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Github } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Install Paradox, instrument semantic operations, register WebMCP tool surfaces, and define business invariants.",
};

const install = "bun add github:Joe-Simo/paradox-webmcp";
const eventExample = `import { createSemanticEvent } from "paradox-webmcp";

const event = createSemanticEvent({
  id: "evt_003",
  actor: "agent",
  action: "approve_reviewed_expense",
  invocationSource: "webmcp",
  entityIds: ["expense:481"],
  reads: ["expense:481:version", "review:v7"],
  writes: ["expense:481:status"],
  preStateHash,
  postStateHash,
  logicalTime: 3,
  metadata: { reviewedVersion: 7, committedVersion: 8 },
});`;
const invariantExample = `import { defineInvariant } from "paradox-webmcp";

type Ledger = { expenses: Record<string, { version: number }> };
type ReviewEvent = { id: string; entityIds: string[]; metadata: { reviewedVersion: number } };

export const reviewedStateMatchesCommit = defineInvariant({
  id: "review_version_matches_commit",
  title: "Reviewed state must equal committed state",
  evaluate(previous: Ledger, event: ReviewEvent, current: Ledger) {
    const reviewed = event.metadata.reviewedVersion;
    const committed = current.expenses[event.entityIds[0]].version;
    return reviewed === committed
      ? { ok: true }
      : {
          ok: false,
          invariantId: "review_version_matches_commit",
          title: "Reviewed state must equal committed state",
          explanation: \`Reviewed v\${reviewed}; committed v\${committed}.\`,
          relevantEventIds: [event.id],
        };
  },
});`;
const registryExample = `import { activateToolSurface } from "paradox-webmcp";

const context = document.modelContext ?? navigator.modelContext;
if (!context) return; // no WebMCP host on this page

const stop = activateToolSurface({
  context,
  tools: [inspectExpense, approveReviewedExpense],
  onToolsChanged: (tools) => renderCapabilityRail(tools),
  onError: (error) => reportRegistrationFailure(error),
});

// Remove every tool as soon as this page state becomes invalid.
return stop;`;

function CodeBlock({ children, label }: { children: string; label: string }) {
  return <div className="docs-code"><div><span>{label}</span><span>TypeScript</span></div><pre tabIndex={0}><code>{children}</code></pre></div>;
}

export default function DocumentationPage() {
  return (
    <div className="docs-page">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="docs-header">
        <Link href="/" className="wordmark" aria-label="Paradox home" translate="no">Paradox</Link>
        <nav aria-label="Documentation navigation"><Link href="/"><ArrowLeft aria-hidden="true" /> Product</Link><a href="https://github.com/Joe-Simo/paradox-webmcp" target="_blank" rel="noreferrer"><Github aria-hidden="true" /> GitHub</a><Link href="/lab/expense-approval/ledger">Open lab <ArrowRight aria-hidden="true" /></Link></nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <aside className="docs-index" aria-label="On this page"><span>Integration guide</span><nav><a href="#install">Install</a><a href="#record">Record</a><a href="#invariants">Invariants</a><a href="#webmcp-client">WebMCP lifecycle</a><a href="#limits">Supported model</a></nav></aside>
        <article className="docs-content">
          <header className="docs-hero"><span className="section-label">Paradox instrumentation / 0.1.0</span><h1>Make human-agent<br />time executable.</h1><p>Open-source semantic instrumentation and bounded correctness testing for stateful WebMCP applications.</p></header>
          <section id="install" className="docs-section"><div><span>01</span><h2>Install from the public repository</h2></div><p>The challenge release is installable directly from GitHub. It exports semantic event, invariant, and state-scoped WebMCP lifecycle primitives.</p><CodeBlock label="Terminal">{install}</CodeBlock></section>
          <section id="record" className="docs-section"><div><span>02</span><h2>Record domain operations, not clicks</h2></div><p>Wrap the service boundary shared by the human interface and WebMCP callbacks. Declare actor, source, read set, write set, versions, and canonical state hashes.</p><CodeBlock label="semantic-events.ts">{eventExample}</CodeBlock></section>
          <section id="invariants" className="docs-section"><div><span>03</span><h2>Express the business rule</h2></div><p>Invariants are deterministic functions over previous state, the semantic event, and current state. An LLM never decides whether a branch is safe.</p><CodeBlock label="invariants.ts">{invariantExample}</CodeBlock></section>
          <section id="webmcp-client" className="docs-section"><div><span>04</span><h2>Register only the tools valid now</h2></div><p>The lifecycle helper registers one state-specific tool surface, listens for registry changes, and removes stale capabilities with an AbortController.</p><CodeBlock label="webmcp-surface.ts">{registryExample}</CodeBlock><div className="docs-note"><strong>Client requirement</strong><p>WebMCP tools exist while the page is open in a browser that exposes <code>document.modelContext</code>. Elsewhere, Paradox labels local evaluation controls instead of claiming tools are registered.</p></div></section>
          <section id="limits" className="docs-section docs-limits"><div><span>05</span><h2>Know the explored boundary</h2></div><ul><li>Paradox currently analyzes instrumented deterministic domain models.</li><li>Exploration is bounded and reports an incomplete result if that bound is reached.</li><li>The included product contains one complete expense-approval scenario.</li><li>The demonstrated repair is a semantic version guard, not arbitrary source synthesis.</li><li>Zero findings means none survived the explored model—not universal correctness.</li></ul></section>
          <section className="docs-cta"><div><span className="section-label">Reference implementation</span><h2>See the instrumentation operate a real WebMCP race.</h2></div><Link className={buttonVariants({ size: "lg" })} href="/lab/expense-approval/ledger">Run the lab <ArrowRight aria-hidden="true" /></Link></section>
        </article>
      </main>
    </div>
  );
}
