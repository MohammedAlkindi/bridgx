# BridgX Roadmap

## Phase 0 — Hackathon MVP (Current)

- Quote-first UX for BTC bridge flow.
- FastAPI quote and provider integration.
- Source-side execution contract scaffold.
- Demo compatibility via frontend mock fallbacks.

## Phase 1 — Production Bridge Orchestration

- Implement `/bridge/initiate`, `/status`, `/receipt` backend APIs.
- Persist transfer lifecycle state in durable DB.
- Add worker/queue for asynchronous attestation polling.
- Introduce idempotency keys and replay-safe execution.

## Phase 2 — Reliability & Security Hardening

- Add structured logging and distributed tracing.
- Add rate limiting and abuse controls.
- Add contract test suite expansion (unit + fork + invariant).
- Commission independent security review.

## Phase 3 — Protocol Expansion

- Add more BTC-like assets and wrapped variants.
- Expand supported source/destination chains.
- Add multi-provider pathfinder with best-execution scoring.

## Phase 4 — UX and Product Growth

- Unified transfer timeline with live event stream.
- Gas sponsorship and intent-based one-click execution.
- Public status page and SLA dashboard.
