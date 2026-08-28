# Paradox

**Explore every future before your users do.**

[Live product](https://www.paradoxwebmcp.com) · [Integration guide](https://www.paradoxwebmcp.com/docs) · [Start the instrumented scenario](https://www.paradoxwebmcp.com/lab/expense-approval/ledger)

Paradox is a deterministic correctness lab for the human-agent web. It records semantic operations from an instrumented expense workflow, explores valid human-agent interleavings, finds invariant violations, produces a shortest replayable counterexample, applies a constrained version guard, and verifies the same model again.

The challenge scenario is real: an agent inspects expense 481 at `$2,399 · v7`, a human changes it to `$23,999 · v8`, and the intentionally unsafe approval implementation commits the changed state. Paradox discovers that stale-review race from the running model checker rather than a hardcoded failure branch.

## Install the instrumentation package

```bash
bun add github:Joe-Simo/paradox-webmcp
```

```ts
import { activateToolSurface, createSemanticEvent, defineInvariant } from "paradox-webmcp";
```

The SDK (dependency-free source) exports semantic events, deterministic invariants, and state-scoped WebMCP registration. Events distinguish `webmcp`, `local_control`, and `system` invocation sources so every operation remains auditable.

## WebMCP tools

Paradox uses one `document.modelContext` registry. The active tool surface changes with product state—even when an agent stays on the same route:

- Fixture: `inspect_expense`, `approve_reviewed_expense`
- Exploration: `inspect_lab`, `explore_futures`, `reset_lab`
- Finding: `inspect_lab`, `inspect_counterexample`, `apply_version_guard`, `reset_lab`
- Verification: `inspect_lab`, `verify_repair`, `reset_lab`

Every callback reads the current Zustand state, invokes the same domain services as the human interface, and persists its result to IndexedDB. Tool outputs are intentionally compact, agent cancellation terminates active exploration Workers, and AbortControllers remove capabilities as soon as they become invalid.

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
- Exploration is bounded; a reached bound reports `incomplete_bound` and cannot produce verification.
- The demonstrated repair is a semantic version guard, not general source synthesis.
- Zero counterexamples means none survived the explored model, not that the application is universally safe.
- No model API participates in scheduling, hashing, invariant evaluation, or verification.
- Paradox is a live WebMCP website, not a PWA, browser extension, or persistent MCP server. Its tools exist only while the page is open in a supported agent browser.

## License

GNU Affero General Public License v3.0 only. See [LICENSE](./LICENSE).
