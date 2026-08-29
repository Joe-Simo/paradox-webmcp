# Paradox

**Explore every future before your users do.**

[Watch the 2:00 demo](https://youtu.be/mBkLOa7VWFw) · [Live product](https://www.paradoxwebmcp.com) · [Integration guide](https://www.paradoxwebmcp.com/docs) · [Start the instrumented scenario](https://www.paradoxwebmcp.com/lab/expense-approval/ledger)

Paradox is a testing tool for the human-agent web — think Playwright, but for what happens when an AI agent and a human act on the same state at once. It records semantic operations from an instrumented expense workflow, explores valid human-agent interleavings, finds invariant violations, produces a shortest replayable counterexample, applies a constrained version guard, and verifies the same model again.

The challenge scenario is real: an agent inspects expense 481 at `$2,399 · v7`, a human changes it to `$23,999 · v8`, and the intentionally unsafe approval implementation commits the changed state. Paradox discovers that stale-review race from the running model checker rather than a hardcoded failure branch.

## Install the instrumentation package

```bash
bun add github:Joe-Simo/paradox-webmcp
```

```ts
import { createRecorder, analyzeRecording, verifyRecordingRepair, activateToolSurface, createSemanticEvent, defineInvariant, exploreInterleavings, verifyRepair } from "paradox-webmcp";
```

The SDK (dependency-free source) exports the complete tester — including a fully automatic path: `createRecorder` captures each operation as one line (actor, reads, writes), and `analyzeRecording` synthesizes the model from the recording itself, explores every interleaving, and reports every schedule where an operation committed on an overwritten belief; `verifyRecordingRepair` proves the version-guarded fix. No hand-written model, no hand-written invariant. Beneath it sit the precision primitives: semantic events, deterministic invariants, state-scoped WebMCP registration — and the bounded interleaving explorer itself. `exploreInterleavings` walks every schedule of your operations, merges canonically equivalent states, checks your invariants, and minimizes the first counterexample to its essential operations; `verifyRepair` replays that counterexample exactly against your repaired contract and re-explores the full model. A cross-validation test expresses the expense race purely through this public API and reproduces the lab engine's published numbers — 36 schedules, 27 counterexamples, 9 → 3 minimization, verified guard — two independent implementations agreeing. Events distinguish `webmcp`, `local_control`, and `system` invocation sources so every operation remains auditable.

## WebMCP tools

Paradox registers real tools on the page's model context (`document.modelContext`, with a `navigator.modelContext` fallback). Under the hood every tool goes through the standard registration call:

```ts
const context = document.modelContext ?? navigator.modelContext;
await context?.registerTool({
  name: "inspect_expense",
  description: "Inspect one pending expense and create a version-bound review token.",
  inputSchema: {
    type: "object",
    properties: { expenseId: { type: "string", description: "Expense identifier. Defaults to 481." } },
    additionalProperties: false,
  },
  execute: async (input) => inspectExpenseService(parse(input).expenseId, "webmcp"),
});
```

`activateToolSurface` (in `sdk/index.ts`) wraps exactly this call with an AbortController lifecycle, `toolchange` observation, and rollback on partial registration failure, so each product state exposes only the tools that are valid in it.

The active tool surface changes with product state—even when an agent stays on the same route:

- Fixture: `inspect_expense`, `approve_reviewed_expense`
- Exploration: `inspect_lab`, `explore_futures`, `reset_lab`
- Finding: `inspect_lab`, `inspect_counterexample`, `apply_version_guard`, `reset_lab`
- Verification: `inspect_lab`, `verify_repair`, `reset_lab`

Every callback reads the current Zustand state, invokes the same domain services as the human interface, and persists its result to IndexedDB. Tool outputs are intentionally compact, agent cancellation terminates active exploration Workers, and AbortControllers remove capabilities as soon as they become invalid.

## Security posture

The WebMCP spec's security considerations note that "there is no guarantee that a WebMCP tool's declared intent matches its actual behavior" — verifying actual tool behavior against business invariants is exactly the gap Paradox exists to close. The tool surface itself follows the spec's recommended mitigations:

- **Validated inputs.** Every tool parses its input with zod before touching state; malformed or out-of-range arguments return structured `INVALID_INPUT` errors instead of executing.
- **No injection surface in metadata.** Tool names, descriptions, and schemas are static author-written strings; no user or agent content ever flows into them.
- **No untrusted content in results.** Tool outputs are structured fields — amounts, versions, ids, enum error codes. The only human-editable value in the model is a number, so no user-authored free text is ever echoed back to the agent.
- **Least privilege via state-scoped surfaces.** Only the tools valid in the current product state are registered; write capabilities disappear the moment they become invalid.
- **Honest annotations.** `readOnlyHint` reflects actual behavior (`inspect_expense` is marked as a write because it mints a review token).
- **Guarded consequential writes.** After repair, the approval tool requires the version the agent's belief was formed on and refuses stale commits with `STATE_CHANGED` — belief-carrying writes as a concrete defense for consequential actions.
- **Permissions-Policy.** The site ships `Permissions-Policy: tools=(self)`, the spec's policy gate.

## How it works

1. Pure TypeScript commands operate the instrumented Ledger fixture and emit semantic events.
2. A Web Worker compiles those operations into yieldable micro-steps.
3. Bounded breadth-first search explores valid schedules and merges equivalent states by canonical SHA-256 hash.
4. Business invariants inspect committed states without an LLM.
5. The first failing path becomes a persisted counterexample.
6. Guarded commit semantics compare the current expense version with the inspected version.
7. Exact replay and full bounded exploration report separate computed results.

## The observatory

The landing page is a cinematic relativistic black hole rendered in WebGPU, adapted from the optimized [vgpu](https://vgpu.sh) hero pipeline (MIT, Vercel Labs): geodesics are baked once into a G-buffer, so each frame only shades the Keplerian accretion disk and lensed star field before a three-scale HDR bloom. The frame stays monochrome until the race commits its violation — the mistake is the only color that ever enters the universe — and scrolling the four acts drains it back out: exploration holds the crimson, the guard cools it, and Verify returns the frame to monochrome. The step buttons and the scroll journey drive the same uniforms. Performance discipline is inherited from the example: DPR-1 rendering, a paced 60fps loop that pauses offscreen and on hidden tabs, and re-bakes only on resize. Without WebGPU the page falls back to a static deep field; under reduced motion it renders a single still frame.

## Measured golden model

These values are computed by the engine; the key claims are asserted by unit and browser tests; they are not presentation constants.

| Model | Schedules | Unique states | Equivalent branches merged | Counterexamples |
| --- | ---: | ---: | ---: | ---: |
| Unsafe approval | 36 | 36 | 11 | 27 |
| Version-guarded approval | 36 | 34 | 10 | 0 |

The unsafe counterexample contains nine semantic microsteps. Delta minimization proves that three domain operations are essential: `inspect_expense → edit_expense_amount → approve_reviewed_expense`.

## Run locally

```bash
bun install
bun run dev
```

Open `http://localhost:3000/lab/expense-approval/ledger` in a WebMCP-capable browser. In Chrome 149+, enable `chrome://flags/#enable-webmcp-testing` (or use the ChatGPT desktop app's in-app browser) and inspect registrations in DevTools → Application → WebMCP.

## Verification

```bash
bun run lint
bun run typecheck
bun test
bun run test:e2e
bun run build
```

## Limitations

- Automatic analysis needs only declared read/write sets per operation; exact semantic invariants require a small hand-written model.
- Modeled state must be JSON-plain data (plain objects, arrays, strings, numbers, booleans, null); Map, Set, and Date are rejected loudly rather than hashed unsoundly.
- Exploration is bounded; a reached bound reports `incomplete_bound` and cannot produce verification.
- The demonstrated repair is a semantic version guard, not general source synthesis.
- Zero counterexamples means none survived the explored model, not that the application is universally safe.
- No model API participates in scheduling, hashing, invariant evaluation, or verification.
- Paradox is a live WebMCP website, not a PWA, browser extension, or persistent MCP server. Its tools exist only while the page is open in a supported agent browser.

## License

GNU Affero General Public License v3.0 only. See [LICENSE](./LICENSE).
