# Paradox

### ⏳ Not submitted yet
Nothing has been sent to Devpost.

## One-line Summary

Paradox systematically explores the interleavings between human actions and WebMCP agent operations, finds invalid application states, produces the shortest replayable counterexample, and verifies whether a semantic guard eliminates the dangerous future.

**Tagline:** The correctness lab for the human-agent web.

## Problem

Software used to have one operator at a time. WebMCP gives the same live application two: a human using the interface and an agent invoking structured tools.

Each path can look correct in isolation while their interleaving is unsafe. An agent can inspect one version of an object, a human can change it, and the agent can then commit an action based on a state that is no longer true. Traditional browser tests usually exercise human workflows. Agent evaluations usually exercise tool workflows. Neither systematically tests the states created when both operators act on the same application concurrently.

These failures are especially dangerous in financial systems, administrative consoles, approval workflows, collaborative editors, support applications, and internal business tools because they are timing-dependent and difficult to reproduce from a conventional bug report.

## Solution

Paradox is a deterministic temporal correctness lab for agent-native web applications. It records semantic domain operations from a real WebMCP application, expands them into meaningful yield points, explores valid human-agent schedules, evaluates every reached state against business invariants, and returns the shortest replayable sequence that proves a failure.

The submitted scenario uses a functional expense application called Ledger:

1. The agent calls `inspect_expense` and reviews expense 481 at **$2,399, version 7**.
2. The human changes the amount to **$23,999, version 8**.
3. The agent calls `approve_reviewed_expense` with the review token it already received.
4. The intentionally unsafe implementation approves **$23,999, version 8** even though the agent inspected version 7.
5. Paradox explores the possible micro-operation schedules and detects the violated invariant: the approved version must match the reviewed version.
6. The developer applies a constrained semantic version guard.
7. Paradox replays the exact counterexample and then reruns the full bounded state space.
8. The stale approval is rejected with `STATE_CHANGED`, and no counterexample survives the guarded model.

Nothing in that red branch is prerecorded or hardcoded. Schedules, state hashes, merges, findings, counterexamples, replay results, and verification counts are produced by the running engine.

## Why This Matters

WebMCP turns websites into shared human-agent environments. That creates an emerging correctness problem that ordinary UI automation and isolated agent evaluations do not cover: the agent's read and write can be separated by a human mutation.

Paradox gives developers a concrete answer instead of an intermittent race report:

- what the agent inspected;
- what the human changed;
- what the system committed;
- which invariant failed;
- the shortest sequence that reproduces the failure;
- whether the same sequence and the wider bounded model survive a proposed guard; and
- a shippable pattern: WebMCP write-tools that carry the version their belief was formed on and reject stale commits with `STATE_CHANGED` — the same race ships in carts, bookings, refunds, and permission grants.

The immediate product is an executable correctness lab for an instrumented deterministic application. The larger category is model checking and temporal correctness testing for agent-native web software.

## How It Creates a Better User Experience

For the person on the page, WebMCP means the agent operates the same live state they are looking at — no screen-scraping, no second tab, no stale copy of the data. In Paradox the human edits an amount while the agent inspects and approves through registered tools, and every operation lands in one shared, versioned ledger with a visible trace of who did what. The better experience is trust made concrete: after the version guard ships, an agent write built on a stale belief is refused with `STATE_CHANGED` instead of silently committing the wrong approval. Developers get the same effect one level up — instead of an intermittent bug report, they watch every ordering of a human-agent session unfold and repair the race before a real user ever hits it.

## How We Used AI

ChatGPT is an operator of the product through its real WebMCP surface. On the Ledger surface, the agent can inspect and complete an expense review. On the Paradox surface, it can inspect the lab, launch exploration, inspect a counterexample, apply the constrained guard, verify the repair, and reset the scenario.

The agent is deliberately not trusted to judge correctness. Paradox uses no model API for scheduling, hashing, invariant evaluation, minimization, replay, or verification. Those results come from deterministic TypeScript code. This separation makes the experience agent-native without making the safety result probabilistic.

The active WebMCP capability surface changes with product state. Tool callbacks read the current Zustand store at execution time, so they do not capture stale React values. AbortControllers remove tools when they are no longer valid, and the capability rail reflects the actual registry returned by `document.modelContext`.

## How We Used Codex

Codex was used as the primary engineering collaborator for product architecture, the pure Ledger domain model, WebMCP registration and lifecycle, the bounded explorer, hashing, counterexample minimization, exact replay, browser persistence, the visual product, automated tests, accessibility checks, browser debugging, deployment, and submission preparation.

Codex also helped keep the central claim testable: it traced every displayed result back to engine data, exercised the complete human-agent flow in Playwright, and verified lint, strict TypeScript, unit and property tests, end-to-end tests, and the production build.

Claude Code later drove the observatory redesign: the full-bleed vgpu gravitational-lens landing, the four-act navigation spine, the plain-language clarity pass across the lab, and a verification loop covering WebGPU, static-fallback, reduced-motion, and mobile branches plus the full automated suite.

## Key Features

- **One real WebMCP product:** Ledger and Paradox are connected surfaces of the same application and the same stateful correctness workflow.
- **Real human-agent race:** the unsafe approval implementation genuinely commits a human-modified expense from a stale agent review.
- **Dynamic tools:** capabilities are registered and removed as the workflow changes rather than being simulated in the interface.
- **A physics-true signature visual:** the landing is a cinematic relativistic black hole in WebGPU (vgpu's baked G-buffer pipeline): the frame stays monochrome until the race commits its violation — the only color that ever enters the universe — and the scroll journey through the four acts drains it back out until Verify returns the frame to monochrome. A static deep-field fallback covers browsers without WebGPU, and reduced motion renders one still frame.
- **Four-act spine:** Record → Explore → Repair → Verify is persistent product navigation; locked acts state exactly how to unlock them.
- **Semantic recording:** events contain actors, actions, logical time, versions, read/write sets, review tokens, and pre/post state hashes.
- **Bounded breadth-first exploration:** the engine searches valid schedules and naturally prioritizes short counterexamples.
- **State deduplication:** canonically equivalent machine states merge while preserving accurate schedule multiplicity.
- **Deterministic invariants:** business rules are evaluated in code, not inferred by an LLM.
- **Automatic minimization:** the nine-microstep failing schedule is reduced to three essential domain operations: inspect, edit, approve.
- **Constrained repair:** the lab applies a real semantic version guard to the instrumented domain implementation.
- **Two-level verification:** Paradox separately reports exact counterexample replay and full bounded re-exploration.
- **Accessible temporal interface:** keyboard controls, visible focus, structured text equivalents, contrast-safe status labels, and reduced-motion behavior accompany the multiverse visualization.
- **Local-first reliability:** active state lives in Zustand and recorded sessions/findings persist in IndexedDB; exploration requires no network request after the app loads.

## Architecture

Paradox is a single-origin Next.js 16 application deployed on Vercel.

**Web application**

- Next.js 16 and React 19
- strict TypeScript
- Tailwind CSS v4 and customized shadcn/ui primitives
- Geist Sans and Geist Mono
- Motion for causal transitions
- vgpu (WebGPU) for the baked black-hole hero, with a no-WebGPU static fallback
- Zustand for active state
- IndexedDB via `idb` for local session persistence

**WebMCP surface**

- `inspect_expense`
- `approve_reviewed_expense`
- `inspect_lab`
- `explore_futures`
- `inspect_counterexample`
- `apply_version_guard`
- `verify_repair`
- `reset_lab`

Only the tools valid for the current product state are registered. Registration uses one AbortController per active tool set, listens for `toolchange`, and reads the current store during execution.

**Correctness engine**

- pure Ledger command model and semantic events
- yieldable inspect, edit, and approval micro-operations
- bounded breadth-first scheduler
- canonical SHA-256 state hashing
- equivalent-state merging
- read/write-set partial-order reduction
- deterministic invariant evaluation
- counterexample extraction and delta minimization
- exact replay and guarded re-exploration
- Web Worker execution to keep the interface responsive

**Measured golden model**

| Model | Schedules explored | Unique states | Equivalent branches merged | Counterexamples |
| --- | ---: | ---: | ---: | ---: |
| Unsafe approval | 36 | 36 | 11 | 27 |
| Version-guarded approval | 36 | 34 | 10 | 0 |

These values are computed by the engine and the key values are asserted by automated tests; none are display constants.

**Built with:** Next.js, React, TypeScript, WebMCP, WebGPU, vgpu, Bun, Tailwind CSS, shadcn/ui, Motion, Zustand, Zod, D3, IndexedDB, Vitest, fast-check, Playwright, Vercel.

## Testing Instructions

Paradox is a live WebMCP website, not a PWA, extension, downloadable package, or remote MCP server. Open it in a WebMCP client:

- **ChatGPT desktop app** — use the in-app browser (WebMCP is supported by default).
- **Google Chrome 149+** — enable `chrome://flags/#enable-webmcp-testing`, restart the browser.

The same product is fully navigable by a human when WebMCP is unavailable, but agent tools require a supported client. If the site was opened before enabling tools, no reload is needed — Paradox detects a host that appears after load.

1. Open the [instrumented Ledger scenario](https://www.paradoxwebmcp.com/lab/expense-approval/ledger).
2. Ask the agent: **"Review expense 481 and tell me whether it is below the policy limit."** It should invoke `inspect_expense` and return $2,399, version 7, below the $3,000 limit.
3. In the human interface, choose **Edit Amount**, enter `23999`, and commit the change. The expense becomes $23,999, version 8.
4. Ask the agent: **"Complete the review you started."** It should invoke `approve_reviewed_expense`. The intentionally unsafe lab implementation approves $23,999.
5. Open **Explore Futures** and ask: **"Find any unsafe human-agent timing in this session."** It should invoke `explore_futures`.
6. Select **Focus Counterexample** or ask: **"Explain the shortest failure."** The three-operation sequence should be `inspect_expense → edit_expense_amount → approve_reviewed_expense`.
7. Ask: **"Apply the recommended protection."** It should invoke `apply_version_guard`.
8. Ask: **"Prove that the same failure no longer survives."** It should invoke `verify_repair`.
9. Confirm exact replay returns `STATE_CHANGED`, full exploration completes, and surviving counterexamples equal zero.
10. Use `reset_lab` or the visible reset control to restore the deterministic initial state.

No account, API key, financial data, or backend setup is required. Testing is free and unrestricted during judging.

For local verification:

```bash
bun install
bun run lint
bun run typecheck
bun test
bun run test:e2e
bun run build
```

## Public Demo Link

https://www.paradoxwebmcp.com

## Public Repository Link

https://github.com/Joe-Simo/paradox-webmcp

## Demo Video

**Deferred by product decision until the final submission pass.**

`[TODO — add the public YouTube URL; under three minutes; audio required]`

The locked recording target is 2 minutes 45 seconds and will show the live sequence: inspect $2,399/v7 → human edit to $23,999/v8 → stale approval → computed counterexample → version guard → exact replay returns `STATE_CHANGED` → guarded exploration returns zero counterexamples.

## Screenshot Shot List

The following upload-ready PNGs were captured from the public production build at 1440×900 or as clean content-surface crops:

1. **Observatory landing at the unsafe commit:** [`docs/submission-assets/01-paradox-landing.png`](docs/submission-assets/01-paradox-landing.png) — the WebGPU black hole at the Commit act, crimson flooding an otherwise monochrome frame.
2. **Ledger inspection:** [`docs/submission-assets/02-ledger-inspected.png`](docs/submission-assets/02-ledger-inspected.png) — $2,399/v7 with the agent review token.
3. **Unsafe commit:** [`docs/submission-assets/03-ledger-unsafe-commit.png`](docs/submission-assets/03-ledger-unsafe-commit.png) — $23,999/v8 approved while the agent belief remains $2,399/v7.
4. **Hero / project thumbnail:** [`docs/submission-assets/04-multiverse-finding.png`](docs/submission-assets/04-multiverse-finding.png) — the computed $23,999/v8 counterexample branch, metrics, and shortest failure.
5. **Counterexample focus:** [`docs/submission-assets/05-counterexample-focus.png`](docs/submission-assets/05-counterexample-focus.png) — Observed / Changed / Committed planes, invariant, minimization, and repair.
6. **Verified repair:** [`docs/submission-assets/06-verified-repair.png`](docs/submission-assets/06-verified-repair.png) — the same branch stopped at `STATE_CHANGED`, with exact replay blocked and zero surviving counterexamples.

Recommended Devpost order: multiverse hero, Ledger race, counterexample explanation, verified replay. Avoid using a code screenshot as the first image.

## Submission Readiness Notes

- The authenticated Devpost account is registered for The WebMCP Challenge.
- The entrant explicitly confirmed compliance with the official eligibility rules on August 26, 2026.
- Paradox was created during the challenge submission period and should be classified as **New**.
- The public Vercel application and public GitHub repository are already available without authentication.
- The repository contains the full source, setup and test instructions, a detected AGPL-3.0-only license, and real `document.modelContext` registration code.
- The Devpost account currently has no Paradox project draft; create it only after the remaining personal form choices below are confirmed.
- Do not submit until the public YouTube video is uploaded, every form answer is confirmed, all public links are checked while logged out, and the user explicitly authorizes submission.

## Known Limitations

- Paradox currently analyzes one instrumented deterministic domain model.
- Exploration is bounded. Reaching the configured node bound reports an incomplete result and cannot produce verification.
- The submitted repair is a semantic version guard applied to this instrumented lab, not arbitrary source-code synthesis.
- Zero counterexamples means none survived the explored model; it is not a proof of universal correctness.
- Paradox does not automatically infer arbitrary production state models or invariants.
- The challenge version contains one complete expense-approval scenario.
- WebMCP tools exist only while the site is open in a supported agent browser.

## TODO Official Form Fields

The official form does **not** request a Codex session ID.

| Field | Draft answer | Status |
| --- | --- | --- |
| Submitter Type | `[TODO — confirm Individual, Team of Individuals, or Organization]` | Required personal choice |
| Country of residence | `[TODO — provide the official country value]` | Required eligibility field; never infer |
| Organization name | Leave blank unless Submitter Type is Organization | Optional |
| App Status | New | Ready |
| Existing-app update | Not applicable | Ready |
| Live app URL | https://www.paradoxwebmcp.com | Ready |
| Testing instructions | Use the ten-step WebMCP workflow above | Ready |
| Public repository | https://github.com/Joe-Simo/paradox-webmcp | Ready |
| Tested agent/client | ChatGPT in-app browser for live WebMCP; Playwright Chromium for automated product and registry-lifecycle verification | Ready; recheck live before submission |
| AI tools leveraged | Codex for architecture, implementation, testing, debugging, design refinement, deployment, and submission preparation; ChatGPT for product direction and live WebMCP agent operation/evaluation; Claude Code for the observatory redesign, the vgpu gravitational-lens implementation, and design verification | Ready |
| Learning level | `[TODO — recommended: Significant]` | Required personal choice |
| Career AI value | `[TODO — recommended: Yes]` | Required personal choice |
| Public demo video | `[TODO — public YouTube URL]` | Required; intentionally last |
