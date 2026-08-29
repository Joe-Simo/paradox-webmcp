import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Github } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Install Paradox, record what each operation reads and writes, and let it explore every human-agent interleaving of your app automatically — then prove your repair.",
  alternates: { canonical: "/docs" },
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
  title: "Approved state must equal inspected state",
  evaluate(previous: Ledger, event: ReviewEvent, current: Ledger) {
    const reviewed = event.metadata.reviewedVersion;
    const committed = current.expenses[event.entityIds[0]].version;
    return reviewed === committed
      ? { ok: true }
      : {
          ok: false,
          invariantId: "review_version_matches_commit",
          title: "Approved state must equal inspected state",
          explanation: \`Reviewed v\${reviewed}; committed v\${committed}.\`,
          relevantEventIds: [event.id],
        };
  },
});`;
const engineExample = `import { analyzeRecording, createRecorder, verifyRecordingRepair } from "paradox-webmcp";

// 1. Record: one line per operation — what it read, what it wrote.
const recorder = createRecorder();
recorder.record("inspect_expense", { actor: "agent", reads: ["expense:481:version"], writes: ["review:481"] });
recorder.record("edit_expense_amount", { actor: "human", reads: [], writes: ["expense:481:version"] });
recorder.record("approve_reviewed_expense", { actor: "agent", reads: ["review:481", "expense:481:version"], writes: ["expense:481:status"] });

// 2. Analyze: every interleaving, automatically. No model, no invariant.
const analysis = analyzeRecording(recorder.events());
analysis.hazard; // → approve committed after its reads were overwritten

// 3. Repair and prove: version-guard the writers, replay, re-explore.
const verdict = verifyRecordingRepair(recorder.events(), analysis.exploration.counterexample!.trace, {
  guarded: ["inspect_expense", "approve_reviewed_expense"],
});
// verdict.verified → the hazard is gone in every ordering.`;
const registryExample = `import { activateToolSurface } from "paradox-webmcp";

export function exposeLedgerTools() {
  const context = document.modelContext ?? navigator.modelContext;
  if (!context) return; // no WebMCP host on this page

  const stop = activateToolSurface({
    context,
    tools: [inspectExpense, approveReviewedExpense],
    onToolsChanged: (tools) => renderCapabilityRail(tools),
    onError: (error) => reportRegistrationFailure(error),
  });

  // Call stop() as soon as this page state becomes invalid.
  return stop;
}`;

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
        <aside className="docs-index" aria-label="On this page"><span>Integration guide</span><nav><a href="#install">Install</a><a href="#engine">Analyze automatically</a><a href="#webmcp-client">WebMCP lifecycle</a><a href="#record">Semantic events</a><a href="#invariants">Exact invariants</a><a href="#limits">Limits</a></nav></aside>
        <article className="docs-content">
          <header className="docs-hero"><span className="section-label">Paradox instrumentation / 0.1.0</span><h1>Make human-agent<br />time executable.</h1><p>Open-source semantic instrumentation and bounded correctness testing for stateful WebMCP applications.</p></header>
          <section id="install" className="docs-section"><div><span>01</span><h2>Install from the public repository</h2></div><p>The current release is installable directly from GitHub. One package exports the complete tester: automatic race analysis from recorded operations, the bounded interleaving explorer, deterministic invariants, semantic events, and state-scoped WebMCP registration.</p><CodeBlock label="Terminal">{install}</CodeBlock></section>
          <section id="engine" className="docs-section"><div><span>02</span><h2>Analyze your app automatically</h2></div><p>Declare what each operation read and wrote — one line each — and <code>analyzeRecording</code> does the rest: it synthesizes the model from the recording, walks every interleaving, and reports every schedule where an operation committed on an overwritten belief, minimized to the essential operations. <code>verifyRecordingRepair</code> proves the version-guarded fix. No hand-written model, no hand-written invariant. Every recorded flow becomes a concurrency test tailored to your app.</p><CodeBlock label="explore.ts">{engineExample}</CodeBlock></section>
          <section id="webmcp-client" className="docs-section"><div><span>03</span><h2>Register only the tools valid now</h2></div><p>The lifecycle helper registers one state-specific tool surface, listens for registry changes, and removes stale capabilities with an AbortController.</p><CodeBlock label="webmcp-surface.ts">{registryExample}</CodeBlock><div className="docs-note"><strong>Client requirement</strong><p>WebMCP tools exist while the page is open in a browser that exposes <code>document.modelContext</code> (or <code>navigator.modelContext</code>). Elsewhere, Paradox labels local evaluation controls instead of claiming tools are registered.</p><p>To connect a real host: in Chrome 149+, enable <code>chrome://flags/#enable-webmcp-testing</code> and inspect registrations in DevTools → Application → WebMCP (or drive the tools with a client such as the Model Context Tool Inspector extension). The ChatGPT desktop app&apos;s in-app browser connects on its own when it opens a page that registers tools.</p></div></section>
          <section id="record" className="docs-section"><div><span>04</span><h2>Record full-fidelity semantic events</h2></div><p>For the complete audit trail the lab itself keeps — actor, invocation source, versions, and canonical state hashes on every operation — wrap the service boundary shared by the human interface and WebMCP callbacks with <code>createSemanticEvent</code>.</p><CodeBlock label="semantic-events.ts">{eventExample}</CodeBlock></section>
          <section id="invariants" className="docs-section"><div><span>05</span><h2>Prove exact business rules</h2></div><p>Beyond the structural stale-commit race, express precise rules as deterministic functions and run them with the modeled <code>exploreInterleavings</code> / <code>verifyRepair</code> tier — the expense race expressed that way reproduces the lab engine&apos;s published numbers exactly. An LLM never decides whether a branch is safe.</p><CodeBlock label="invariants.ts">{invariantExample}</CodeBlock></section>
          <section id="limits" className="docs-section docs-limits"><div><span>06</span><h2>Know the explored boundary</h2></div><ul><li>Automatic analysis needs only each operation&apos;s declared reads and writes; exact semantic invariants need a small hand-written model.</li><li>Modeled state must be JSON-plain data — plain objects, arrays, strings, numbers, booleans, null. Map, Set, and Date are rejected loudly rather than hashed unsoundly.</li><li>Exploration is bounded and reports an incomplete result if that bound is reached.</li><li>The included product contains one complete expense-approval scenario.</li><li>The demonstrated repair is a semantic version guard, not arbitrary source synthesis.</li><li>Zero findings means none survived the explored model — not universal correctness.</li></ul></section>
          <section className="docs-cta"><div><span className="section-label">Reference implementation</span><h2>See the instrumentation operate a real WebMCP race.</h2></div><Link className={buttonVariants({ size: "lg" })} href="/lab/expense-approval/ledger">Run the lab <ArrowRight aria-hidden="true" /></Link></section>
        </article>
      </main>
    </div>
  );
}
