# Paradox

**Explore every future before your users do.**

[Live product](https://paradox-webmcp.vercel.app) · [Integration guide](https://paradox-webmcp.vercel.app/docs) · [Start the instrumented scenario](https://paradox-webmcp.vercel.app/lab/expense-approval/ledger)

Paradox is a deterministic correctness lab for the human-agent web. It records semantic operations from an instrumented expense workflow, explores valid human-agent interleavings, finds invariant violations, produces a shortest replayable counterexample, applies a constrained version guard, and verifies the same model again.

The challenge scenario is real: an agent inspects expense 481 at `$2,399 · v7`, a human changes it to `$23,999 · v8`, and the intentionally unsafe approval implementation commits the changed state. Paradox discovers that stale-review race from the running model checker rather than a hardcoded failure branch.

## Install the instrumentation package

```bash
bun add github:Joe-Simo/paradox-webmcp
```

```ts
import { activateToolSurface, createSemanticEvent, defineInvariant } from "paradox-webmcp";
```

The dependency-free package exports semantic events, deterministic invariants, and state-scoped WebMCP registration. Events distinguish `webmcp`, `local_control`, and `system` invocation sources so every operation remains auditable.

## WebMCP tools

Paradox uses one `document.modelContext` registry. The active tool surface changes with product state—even when an agent stays on the same route:

- Fixture: `inspect_expense`, `approve_reviewed_expense`
- Exploration: `inspect_lab`, `explore_futures`, `reset_lab`
- Finding: `inspect_counterexample`, `apply_version_guard`, `reset_lab`
- Verification: `verify_repair`, `reset_lab`

Every callback reads the current Zustand state, invokes the same domain services as the human interface, and persists its result to IndexedDB. Tool outputs are intentionally compact, agent cancellation terminates active exploration Workers, and AbortControllers remove capabilities as soon as they become invalid.

## How it works

1. Pure TypeScript commands operate the instrumented Ledger fixture and emit semantic events.
2. A Web Worker compiles those operations into yieldable micro-steps.
3. Bounded breadth-first search explores valid schedules and merges equivalent states by canonical SHA-256 hash.
4. Business invariants inspect committed states without an LLM.
5. The first failing path becomes a persisted counterexample.
6. Guarded commit semantics compare the current expense version with the inspected version.
7. Exact replay and full bounded exploration report separate computed results.

## Measured golden model

These values are computed by the engine and asserted by the browser flow; they are not presentation constants.

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

Open `http://localhost:3000/lab/expense-approval/ledger` in a WebMCP-capable browser. In Chrome testing builds, enable the WebMCP testing flag and inspect registrations in DevTools → Application → WebMCP.

## Verification

```bash
bun run lint
bun run typecheck
bun test
bun run test:e2e
bun run build
```

## Limitations

- Paradox currently analyzes one instrumented deterministic domain model.
- Exploration is bounded; a reached bound reports `INCOMPLETE_BOUND` and cannot produce verification.
- The demonstrated repair is a semantic version guard, not general source synthesis.
- Zero counterexamples means none survived the explored model, not that the application is universally safe.
- No model API participates in scheduling, hashing, invariant evaluation, or verification.
- Paradox is a live WebMCP website, not a PWA, browser extension, or persistent MCP server. Its tools exist only while the page is open in a supported agent browser.

## License

GNU Affero General Public License v3.0 only. See [LICENSE](./LICENSE).
