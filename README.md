# BridgX

BridgX is a prototype cross-chain bridge composed of a Next.js frontend, a Python + FastAPI backend, and a Solidity source/destination-chain executor contracts. Hackathon MVP focused on WETH and wrapped BTC moving from Avalanche to Base, which can be easily expanded to 10+ chains and 100+ tokens.

The unique idea is to chain Circle CCTP allowing for zero-fee cross-chain USDC transfers with cutting-edge smart routing by Odos for the best swap rates. In internal tests it beats other bridges in ~50% of cases.

## How it works
1. BridgX queries Odos to compute the optimal swap route for the token to USDC on the source chain.
2. USDC is burned through CCTP.
3. CCTP attestates the burnt USDC for the cross-chain transfer, minting the same amount of the USDC on the destination chain.
4. Upon arrival on the destination chain, the USDC swaps to the target token via Odos, and gets delivered to the user. 

## Current status

This repository is a prototype, not a production bridge.

**What is implemented in code:**
- Full cycle (the bridge is fully operational):
  - Frontend UI for wallet connect, chain/token selection, quoting, and transaction submission.
  - Backend integration with Odos quote/assemble APIs, token pricing API.
  - Backend swap + attestation / receipt from CCTP.
  - Transfer of the tokens to the user on the destination network.

**Limitations:**
- Supported wallets:
  - Only Metamask browswer extension is supported
- Supported chains: Avalanche --> Base  
- Supported tokens:
  - Input: WETH, BTC.b, WBTC.e
  - Output: WETH, CBBTC, WBTC, TBTC     

**Contracts deployed:**
SourceExecutor: `0xeC20cbb6C99e4b8b78cbd81b27Ce0B7aaD222A2d` (Avalanche)
DestinationExecutor: `0x25c66179bd654cde97fA4aF6C926Ad4689815E05` (Base)


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
|   ├── tests/                 # end-to-end testing
│   ├── SourceExecutor.sol
|   ├── DestinationExecutor.sol
│   └── *.ipynb                # deployment notebooks
└── docs/
```

## Local development

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
uvicorn backend.api:app --reload --port 8001
```

### 2) Frontend

```bash
cd frontend
npm install
npm run build 
npm run start -- -p 3003
```

```env
DEPLOYER_PRIVATE_KEY="..."
RELAYER_PRIVATE_KEY="..."
DESTINATION_EXECUTOR_BASE="0x25c66179bd654cde97fA4aF6C926Ad4689815E05"
DESTINATION_EXECUTOR_ARBITRUM="0x24EE15Eb102dA77EA3946c5011326b3487642982"
```


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
