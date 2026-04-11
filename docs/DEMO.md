# Demo script (aligned with current implementation)

## Preconditions

- Backend running at `http://localhost:4000`.
- Frontend running at `http://localhost:3000`.
- `frontend/.env.local` points to backend (`NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`).
- MetaMask installed.
- Wallet funded on Avalanche for source transaction gas/token.

Optional for UI-only walkthrough:
- Keep default non-production frontend mode (mock fallbacks active).

## 5-minute walkthrough

1. **Open `/` and connect wallet**
   - Show MetaMask connect button and connected address state.

2. **Select route and token pair**
   - Source chain remains Avalanche (other source options are disabled in current UI).
   - Choose destination Base or Arbitrum.
   - Choose source/destination BTC-family or WETH-family token pair from loaded token lists.

3. **Enter amount and show quote**
   - Enter amount in input.
   - Explain debounced quote request (`POST /quote`) and route expiry timestamp shown in response data model.

4. **Submit bridge transaction**
   - Explain allowance check + approve tx if required.
   - Explain assembled transaction from backend (`POST /assemble`) then wallet submission.

5. **Show attestation and receipt progression**
   - UI status text should transition through submitting/waiting messages while backend polls Iris and posts destination relay tx.
   - Show source/destination explorer links at bottom once hashes are available.

## Honest caveats to mention during demo

- `/bridge/[id]` tracking page is not backed by implemented `/bridge/*` backend endpoints yet.
- Non-production frontend mode can return mock responses for some API calls if backend routes fail.
- This is a prototype flow and not documented as production-ready.
