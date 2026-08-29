# Paradox — Devpost Submission Dossier

The canonical content for the WebMCP Challenge entry. Fields marked `[TODO]` are personal choices entered on the form at submission time.

## One-line Summary

Paradox is a testing tool for WebMCP apps. It systematically explores the interleavings between human actions and WebMCP agent operations, finds invalid application states, produces the shortest replayable counterexample, and verifies whether a semantic guard eliminates the dangerous future. It is built for developers shipping WebMCP applications in which humans and agents can modify the same live state.

**Tagline:** A testing tool for WebMCP apps — find the race, prove the fix.

## Problem

Software used to have one operator at a time. WebMCP gives the same live application two: a human using the interface and an agent invoking structured tools.

Each path can look correct in isolation while their interleaving is unsafe. This is not an agent-quality problem — in the recorded race the agent behaves exactly as instructed. It is an application-contract problem, which is why the repair lives in the tool contract, not in the model. An agent can inspect one version of an object, a human can change it, and the agent can then commit an action based on a state that is no longer true. Traditional browser tests usually exercise human workflows. Agent evaluations usually exercise tool workflows. Neither systematically tests the states created when both operators act on the same application concurrently.

These failures are especially dangerous in financial systems, administrative consoles, approval workflows, collaborative editors, support applications, and internal business tools because they are timing-dependent and difficult to reproduce from a conventional bug report.

## Solution

Paradox is a testing tool for agent-native web applications — Playwright tests your pages; Paradox tests what happens when a human and an AI agent act on the same live state at the same time. It records semantic domain operations from a real WebMCP application, expands them into meaningful yield points, explores valid human-agent schedules, evaluates every reached state against business invariants, and returns the shortest replayable sequence that proves a failure.

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
- a shippable pattern: WebMCP write-tools that carry the version their belief was formed on and reject stale commits with `STATE_CHANGED`.

The expense scenario is a reference implementation of a category, not the category itself. The identical race ships everywhere agents act on state a human can change mid-flight:

- a shopping agent completes a purchase after the human changes the quantity;
- a booking agent confirms a reservation after the human changes the date;
- a permissions agent grants access after the resource's sensitivity changes.

The immediate product is an executable correctness lab for an instrumented deterministic application. The larger category is model checking and temporal correctness testing for agent-native web software.

## How It Creates a Better User Experience

For the person on the page, WebMCP means the agent operates the same live state they are looking at — no screen-scraping, no second tab, no stale copy of the data. In Paradox the human edits an amount while the agent inspects and approves through registered tools, and every operation lands in one shared, versioned ledger with a visible trace of who did what. The better experience is trust made concrete: after the version guard ships, an agent write built on a stale belief is refused with `STATE_CHANGED` instead of silently committing the wrong approval. Developers get the same effect one level up — instead of an intermittent bug report, they watch every ordering of a human-agent session unfold and repair the race before a real user ever hits it.

## How We Used AI

ChatGPT is an operator of the product through its real WebMCP surface. On the Ledger surface, the agent can inspect and complete an expense review. On the Paradox surface, it can inspect the lab, launch exploration, inspect a counterexample, apply the constrained guard, verify the repair, and reset the scenario.

The agent is deliberately not trusted to judge correctness. Paradox uses no model API for scheduling, hashing, invariant evaluation, minimization, replay, or verification. Those results come from deterministic TypeScript code. This separation makes the experience agent-native without making the safety result probabilistic.

The active WebMCP capability surface changes with product state. Tool callbacks read the current Zustand store at execution time, so they do not capture stale React values. AbortControllers remove tools when they are no longer valid, and the capability rail reflects the actual registry returned by `document.modelContext`.

## How Paradox Maps to the Judging Criteria

**WebMCP Leverage.** Every agent operation runs through real tools registered on `document.modelContext` (with a `navigator.modelContext` fallback) — nothing is simulated in the UI. The capability surface is dynamic and state-scoped: 2 tools on the ledger, 3 during exploration, 4 at the finding; stale tools retire through an AbortController and `toolchange` keeps the on-page rail truthful to the actual registry. Tool results carry `guide` fields, so the tools themselves steer an agent (or a judge) through record → explore → repair → verify. Verified live end-to-end in the ChatGPT in-app browser, including a non-scripted amount ($1,337) proving results are computed, not canned.

**Execution.** Deterministic bounded model checking with published, test-asserted numbers: 36 schedules, 27 counterexamples, 9 → 3 minimization, guarded re-exploration 36 / 34 / 0. Strict TypeScript, lint, 24 unit tests, 5 Playwright e2e (including accessibility), production build — plus an installable SDK whose automatic tier turns one recorded line per operation (actor, reads, writes) into a complete interleaving analysis. The 2:00 4K60 demo is rendered entirely from the live product.

**Potential Impact.** The stale-read race is the defining failure mode of the human-agent web — it ships in carts, bookings, refunds, approvals, and permissions the moment an agent and a human share live state. Paradox gives WebMCP developers a Playwright-shaped tool for exactly that failure class, and proves repairs instead of asserting them.

**Creativity.** The lab is the proof: a real expense application whose only color enters the universe when the race commits its violation — and drains back out as the guard eliminates every dangerous future. Counterexample-first storytelling: the bug is shown, minimized, repaired, and re-proven in one continuous product story.

## How We Used Codex

Codex was used as the primary engineering collaborator for product architecture, the pure Ledger domain model, WebMCP registration and lifecycle, the bounded explorer, hashing, counterexample minimization, exact replay, browser persistence, the visual product, automated tests, accessibility checks, browser debugging, deployment, and submission preparation.

Codex also helped keep the central claim testable: it traced every displayed result back to engine data, exercised the complete human-agent flow in Playwright, and verified lint, strict TypeScript, unit and property tests, end-to-end tests, and the production build.

Claude Code later drove the observatory redesign — the full-bleed vgpu gravitational-lens landing, the four-act navigation spine, the plain-language clarity pass across the lab, and a verification loop covering WebGPU, static-fallback, reduced-motion, and mobile branches plus the full automated suite — and then completed the SDK: it generalized the lab's engine into the dependency-free `exploreInterleavings`/`verifyRepair` explorer, built the fully automatic tier (`createRecorder`/`analyzeRecording`/`verifyRecordingRepair`), wrote the cross-validation tests that reproduce the lab's published numbers through the public API alone, produced the 4K demo film, and ran the final copy pass that keeps the framing on the tool contract rather than the agent.

## Key Features

- **One real WebMCP product:** Ledger and Paradox are connected surfaces of the same application and the same stateful correctness workflow.
- **Real human-agent race:** the unsafe approval implementation genuinely commits a human-modified expense from a stale agent review.
- **Dynamic tools:** capabilities are registered and removed as the workflow changes rather than being simulated in the interface.
- **The SDK ships the full tester, with a fully automatic path:** record each operation as one line of declared reads and writes and `analyzeRecording` synthesizes the model, explores every interleaving, and reports every stale-belief commit — no hand-written model or invariant; `verifyRecordingRepair` proves the guarded fix. For exact semantic invariants, `exploreInterleavings`/`verifyRepair` accept micro-step models — a cross-validation test reproduces the lab's published numbers through the public API alone.
- **Spec-aligned security posture:** zod-validated inputs, static tool metadata, structured results with no user-authored free text, accurate `readOnlyHint` annotations, state-scoped least privilege, and a `Permissions-Policy: tools=(self)` gate — with the version guard itself as the mitigation for consequential writes.
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

**Produced — 2:00, 4K60, AI narration (permitted per the challenge FAQ) with an original score built from Apple-licensed Final Cut Pro sound effects. Every second is live-rendered product footage; nothing is a still or a mockup, and the narration never stops for more than a beat.**

https://youtu.be/mBkLOa7VWFw — **PUBLIC** since Aug 29, 2026, with final title, description, chapters, and thumbnail.

The film opens in plain language before any terminology:

> "The agent reviewed $2,399. The human changed it to $23,999. And the app accepted the agent's stale review — without checking. … This is Paradox — a testing tool for WebMCP apps."

Structure:

- **0:00–0:10** — letterboxed titles over the black hole; the working product is on screen from the first second and the app accepts the stale review on cue.
- **0:10–0:39** — the product's own iris transition into the lab; live WebMCP inspection, human edit, stale approval, crimson violation.
- **0:39–1:01** — Explore Futures; 36 schedules, 27 violating futures, the shortest failing sequence.
- **1:01–1:21** — the counterexample in focus; the version guard installed on the tool contract.
- **1:21–1:32** — the exact failure replayed and blocked with `STATE_CHANGED`; guarded re-exploration leaves zero survivors.
- **1:32–1:51** — one continuous live shot pushed in on the capability rail as it reorganizes 2 → 3 → 4 tools on camera.
- **1:51–2:00** — the proof card ("Exact replay: BLOCKED — STATE_CHANGED · 0 surviving counterexamples"), then the title over the drifting event horizon.

Narration honesty rules: call the repair a **constrained semantic version guard** that is verified against this model — never "Paradox automatically fixes any race." Bounded claims only ("within the explored model"). No copyrighted music, no third-party logos in overlays.

## Screenshot Shot List

The following upload-ready PNGs were captured from the public production build at 1440×900 or as clean content-surface crops:

1. **Observatory landing at the unsafe commit:** [`docs/submission-assets/01-paradox-landing.png`](docs/submission-assets/01-paradox-landing.png) — the WebGPU black hole at the Commit act, crimson flooding an otherwise monochrome frame.
2. **Ledger inspection:** [`docs/submission-assets/02-ledger-inspected.png`](docs/submission-assets/02-ledger-inspected.png) — $2,399/v7 with the agent review token.
3. **Unsafe commit:** [`docs/submission-assets/03-ledger-unsafe-commit.png`](docs/submission-assets/03-ledger-unsafe-commit.png) — $23,999/v8 approved while the agent belief remains $2,399/v7.
4. **Multiverse exploration:** [`docs/submission-assets/04-multiverse-finding.png`](docs/submission-assets/04-multiverse-finding.png) — the computed $23,999/v8 counterexample branch, metrics, and shortest failure.
5. **Counterexample focus:** [`docs/submission-assets/05-counterexample-focus.png`](docs/submission-assets/05-counterexample-focus.png) — Observed / Changed / Committed planes, invariant, minimization, and repair.
6. **Verified repair:** [`docs/submission-assets/06-verified-repair.png`](docs/submission-assets/06-verified-repair.png) — the same branch stopped at `STATE_CHANGED`, with exact replay blocked and zero surviving counterexamples.

Recommended Devpost order — problem → identity → technology → resolution: **counterexample focus (05) first** (its three large dollar values stay readable at thumbnail size in the gallery), then observatory landing (01), multiverse exploration (04), verified repair (06); the Ledger shots (02, 03) follow as supporting detail. Avoid using a code screenshot as the first image.

## Submission Readiness Notes

- The authenticated Devpost account is registered for The WebMCP Challenge.
- The entrant explicitly confirmed compliance with the official eligibility rules on August 26, 2026.
- Paradox was created during the challenge submission period and should be classified as **New**.
- The public Vercel application and public GitHub repository are already available without authentication.
- The repository contains the full source, setup and test instructions, a detected AGPL-3.0-only license, and real `document.modelContext` registration code.
- The Devpost account currently has no Paradox project draft; create it only after the remaining personal form choices below are confirmed.
- Do not submit until the public YouTube video is uploaded, every form answer is confirmed, all public links are checked while logged out, and the user explicitly authorizes submission.

## Known Limitations

- Automatic analysis needs only declared read/write sets per operation; exact semantic invariants require a small hand-written model.
- Exploration is bounded. Reaching the configured node bound reports an incomplete result and cannot produce verification.
- The submitted repair is a semantic version guard applied to this instrumented lab, not arbitrary source-code synthesis.
- Zero counterexamples means none survived the explored model; it is not a proof of universal correctness.
- Paradox does not automatically infer arbitrary production state models or invariants.
- The challenge version contains one complete expense-approval scenario.
- WebMCP tools exist only while the site is open in a supported agent browser.

## Final Release Checklist

- [x] Clean-room judge pass in the ChatGPT desktop in-app browser — PASSED Aug 28: full golden path via real WebMCP tools; surfaces rotated 2 → 3 → 4 → reset; results returned as clean JSON; the race reproduced and was blocked with STATE_CHANGED on a non-scripted amount ($1,337), proving results are computed live.
- [ ] Same pass in Chrome 149+ with `chrome://flags/#enable-webmcp-testing`.
- [x] Video produced, uploaded, and PUBLIC: https://youtu.be/mBkLOa7VWFw
- [ ] Add a prominent "Watch the 2:00 demo" link near the top of README.md.
- [ ] Tag the submitted state `webmcp-challenge-v1.0`, record the commit SHA, and confirm production serves that commit.
- [ ] Submit before the final day if possible; freeze the repo, site, and Devpost entry during judging.

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
| AI tools leveraged | Codex for architecture, implementation, testing, debugging, design refinement, deployment, and submission preparation; ChatGPT for product direction and live WebMCP agent operation/evaluation; Claude Code for the observatory redesign, the vgpu gravitational-lens implementation, the generalized SDK explorer and automatic race-analysis tier, the demo film, and design verification | Ready |
| Learning level | `[TODO — recommended: Significant]` | Required personal choice |
| Career AI value | `[TODO — recommended: Yes]` | Required personal choice |
| Public demo video | https://youtu.be/mBkLOa7VWFw (public) | Ready |
