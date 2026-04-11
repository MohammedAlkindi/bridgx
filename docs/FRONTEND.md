# Frontend Guide

## Stack
- Next.js (App Router)
- TypeScript
- Client-side wallet integration with injected EVM provider (MetaMask)

## Key UX Surface

Main bridge page includes:
- wallet connect/disconnect,
- source/destination chain selectors,
- sats amount input,
- recipient address validation,
- live quote preview,
- bridge CTA.

## Core Behavior

### Validation
- Source and destination chains must differ.
- Amount must be positive numeric sats.
- Recipient must match EVM address format (`0x...40 hex chars`).

### Quote lifecycle
- Quote requests are debounced.
- Quote state clears on user edits to relevant fields.
- Error messages are surfaced contextually.

### Mock mode
The frontend supports mock fallbacks through environment flags, enabling demo continuity when backend orchestration endpoints are unavailable.

## Environment Variables

Use `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_USE_MOCK_API=false
```

## Suggested Frontend Improvements

- Replace inline style blocks with design tokens and component theme primitives.
- Introduce shared form state management for cleaner composability.
- Add integration tests (Playwright/Cypress) for bridge happy-path and error states.
- Add optimistic status streaming when backend SSE is available.
