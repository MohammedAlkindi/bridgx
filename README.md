# BridgX

BridgX is a prototype cross-chain BTC-asset bridge composed of a Next.js frontend, a FastAPI backend, and a Solidity source-chain executor contract. Today, the implemented execution path is Avalanche source only, with destination settlement handled through Circle CCTP message attestation and relay logic in the backend.

## Current status

This repository is a prototype, not a production bridge.

What is implemented in code:
- Frontend UI for wallet connect, chain/token selection, quoting, and transaction submission.
- Backend quote + transaction assembly + swap-intent + attestation + receipt APIs.
- Backend integration with Odos quote/assemble APIs and token pricing API.
- Solidity `SourceExecutor` contract for swap + `depositForBurnWithHook` flow.
- Backend unit tests for quote/assemble/output-amount/token/network/balance/token-price endpoints.

What is partial or not wired end-to-end:
- Transfer tracking endpoints used by `/bridge/[id]` (`/bridge/initiate`, `/bridge/{id}/status`, `/bridge/{id}/receipt`) are not implemented in backend.
- Frontend transfer details page therefore depends on mock fallback behavior in non-production mode.
- Source executor address mapping is configured only for Avalanche in backend defaults.

## Repository layout

```text
BridgX/
├── frontend/                  # Next.js App Router client
│   ├── app/                   # Routes/pages
│   ├── components/            # Reusable UI components
│   ├── lib/                   # API client + wallet helpers
│   └── types.ts               # Shared frontend types
├── backend/                   # FastAPI API service
│   ├── api.py                 # Route handlers + chain/CCTP logic
│   ├── libs/provider.py       # Odos API client helpers
│   ├── libs/token.py          # Token registry helpers
│   ├── libs/quote_store.py    # SQLite quote storage with TTL
│   ├── libs/swap_intent_store.py # SQLite swap-intent storage with TTL
│   └── tests/test_fastapi.py  # API tests
├── solidity/
│   ├── SourceExecutor.sol
│   └── *.ipynb                # deployment/e2e notebooks
└── docs/
```

## Local development

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api:app --reload --host 0.0.0.0 --port 4000
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

By default, frontend API base is `http://localhost:8001`, so set `frontend/.env.local` if backend runs on `:4000`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_USE_MOCK_API=false
```

## Environment variables actually read by code

### Frontend
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_USE_MOCK_API`

### Backend
- `SOURCE_EXECUTOR_AVALANCHE`
- `AVALANCHE_MESSAGE_TRANSMITTER`
- `BASE_MESSAGE_TRANSMITTER`
- `ARBITRUM_MESSAGE_TRANSMITTER`
- `CCTP_MAX_FEE`
- `CCTP_MIN_FINALITY_THRESHOLD`
- `CCTP_HOOK_DATA`
- `CCTP_DESTINATION_CALLER`
- `DESTINATION_EXECUTOR_BASE`
- `DESTINATION_EXECUTOR_ARBITRUM`
- `RELAYER_PRIVATE_KEY` (or fallback `DEPLOYER_PRIVATE_KEY`)
- `ATTESTATION_POLL_ATTEMPTS`
- `ATTESTATION_POLL_INTERVAL_S`
- `QUOTE_TTL_S`
- `QUOTE_DB_PATH`
- `SWAP_INTENT_TTL_S`
- `SWAP_INTENT_DB_PATH`
- `DESTINATION_RELEASE_GAS`
- `RELEASE_DELAY_CHECKS`
- `RELEASE_CHECKS_TTL_S`
- `RECEIVE_RECEIPT_ATTEMPTS`
- `RECEIVE_RECEIPT_INTERVAL_S`
- `RELEASE_RECEIPT_ATTEMPTS`
- `RELEASE_RECEIPT_INTERVAL_S`

Backend loads `.env` from `backend/.env` when present; otherwise it falls back to repo-level `.env`.

## Implemented backend API surface

Implemented endpoints:
- `POST /quote`
- `POST /provider/quote`
- `POST /assemble`
- `POST /output-amount`
- `POST /provider/token-price`
- `POST /token-price`
- `GET /token-price`
- `GET /tokens`
- `GET /networks`
- `GET /token-balance`
- `POST /swap-intent`
- `POST /attestation`
- `POST /receipt`

There is no implemented `/btc-price` endpoint in the backend.

## Frontend behavior that matters for contributors

- Main page executes bridge flow directly via `/quote` -> `/assemble` -> `eth_sendTransaction` -> `/swap-intent` -> `/attestation` -> `/receipt`.
- Source chain selector disables Base and Arbitrum as source; UI effectively drives Avalanche as source for submit flow.
- `MOCK_API_ENABLED` is `true` for non-production builds, so failed API calls often return mock data to keep UI usable during local demos.

## Limitations

- No persistence for transfer lifecycle beyond quote + swap-intent staging; no durable transfer records or status stream.
- No auth/rate limiting.
- No production deployment config, CI pipeline, or contract test suite in this repo.
- Smart contract and relayer flow have not been presented as audited here.

## Docs index

- [Architecture](docs/ARCHITECTURE.md)
- [Frontend behavior](docs/FRONTEND.md)
- [Backend API contract](docs/API_CONTRACT.md)
- [Smart contracts](docs/SMART_CONTRACTS.md)
- [Roadmap](docs/ROADMAP.md)
- [Demo script](docs/DEMO.md)
- [Contributing](docs/CONTRIBUTING.md)
