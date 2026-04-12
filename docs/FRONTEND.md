# Frontend behavior

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS utilities plus inline style objects
- MetaMask/injected-provider wallet calls via `window.ethereum`

## Primary routes

- `/` - main bridge execution flow (implemented)
- `/bridge/[id]` - transfer tracking UI (depends on backend `/bridge/*` routes that are not implemented)
- `/about`, `/roadmap`, `/privacy`, `/terms` - static informational pages

## Main page (`/`) implemented flow

1. Loads networks from `GET /networks`.
2. Loads token list from `GET /tokens`.
3. Fetches token prices via `POST /token-price`.
4. Fetches wallet token balance via `GET /token-balance` after wallet connect.
5. Debounced quote fetch via `POST /quote`.
6. On submit:
   - Checks allowance with `eth_call allowance`.
   - Sends approve tx if needed.
   - Calls `POST /assemble`.
   - Sends assembled tx through MetaMask (`eth_sendTransaction`).
   - Registers destination execution preferences via `POST /swap-intent`.
   - Polls backend `POST /attestation`.
   - Polls backend `POST /receipt` for destination tx confirmation when a destination hash is available.

## Important UI constraints

- Source chain dropdown disables Base and Arbitrum options, so practical source is Avalanche.
- Chain swap button exists but is rendered disabled.
- Amount input label says sats, but submit parsing treats input as token amount scaled by selected token decimals for actual tx amount; quote request separately converts entered string to 8-decimal scaled value.

## Mock behavior

`frontend/lib/api.ts` uses:
- `FORCE_MOCK_API = NEXT_PUBLIC_USE_MOCK_API === "true"`
- `MOCK_API_ENABLED = FORCE_MOCK_API || NODE_ENV !== "production"`

Implications:
- In local dev, several API calls attempt backend first, then return mocks on failure (`quote`, `swap-intent`, `bridge/initiate`, bridge status/receipt, token price, etc.).
- `attestation`, `/receipt`, and on-chain transaction submission still require real backend/chain behavior for end-to-end settlement.
- `getBtcUsdRate()` exists in the client and targets `/btc-price`, but the current backend does not implement that endpoint.

## Environment variables

Use `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_USE_MOCK_API=false
```

If unset, API base defaults to `http://localhost:8001`.

## Gaps to be aware of

- `/bridge/[id]` page does not represent a real backend transfer record lifecycle today.
- Static marketing/legal pages contain claims that may exceed current runtime behavior unless kept in sync manually.
