# BridgX — Cross-Chain Wrapped BTC Bridge

BridgX is a hackathon-focused prototype for bridging BTC-denominated value across EVM L2s with a UX optimized for speed and clarity.

The project currently includes:
- **A Next.js frontend** for wallet connection, quote preview, and transfer tracking flow.
- **A FastAPI backend** for quote computation and provider integrations.
- **A Solidity source-side executor** that can swap to USDC and trigger CCTP-style burns.

---

## Why BridgX

Moving BTC liquidity across ecosystems is still fragmented and frequently forces users to:
- switch between multiple UIs,
- manually compare paths,
- trust opaque intermediary steps.

BridgX aims to provide a single operator-style flow:
1. Choose source and destination chains.
2. Enter amount in satoshis.
3. Connect wallet and receive route output estimate.
4. Execute transfer and monitor status.

---

## Current Project Status (April 11, 2026)

This repository is a **working prototype/MVP**, not a fully productionized bridge.

What works today:
- Frontend quote UX with chain/token controls and MetaMask connect.
- Backend quote endpoints that call Odos and compute two-hop BTC→USDC→BTC output.
- BTC/USD price endpoint with short in-memory cache.
- Smart contract for source-side swap + burn orchestration.

What is still in-progress:
- End-to-end transfer orchestration endpoints (frontend currently includes mock fallback behavior for missing bridge status/initiation routes).
- Full relayer/attestation lifecycle automation.
- Production-grade observability, risk controls, and ops automation.

---

## Repository Structure

```text
BridgX/
├── frontend/                  # Next.js app (App Router)
│   ├── app/                   # Pages/routes
│   ├── components/            # UI components
│   ├── lib/                   # API + wallet helpers
│   └── types.ts               # Shared frontend domain types
├── backend/                   # FastAPI service
│   ├── api.py                 # API routes and models
│   ├── libs/provider.py       # Odos quote/assemble integration
│   ├── libs/token.py          # Token helpers (Web3)
│   └── tests/                 # Backend tests
├── solidity/                  # Smart contracts and notebooks
│   ├── SourceExecutor.sol
│   └── deploy_*.ipynb
└── docs/                      # Deep-dive project docs
```

---

## Quick Start

### 1) Frontend

```bash
cd frontend
npm install
npm run dev
```

Default frontend URL: `http://localhost:3000`

### 2) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api:app --reload --host 0.0.0.0 --port 4000
```

Default backend URL: `http://localhost:4000`

### 3) Point frontend to backend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_USE_MOCK_API=false
```

---

## Core User Flow

1. User connects MetaMask in UI.
2. User selects `sourceChain`, `destinationChain`, and `amountSats`.
3. Frontend requests `POST /quote`.
4. Backend resolves chain token mappings and computes output via two Odos quotes.
5. UI shows estimated destination sats and ETA.
6. User initiates bridge flow (today this route may fall back to mocked responses if not available).

---

## Security & Reliability Principles

- Non-custodial orientation (wallet-driven transaction approval).
- Short-lived quotes to reduce stale pricing risk.
- Defensive API validation via Pydantic models.
- Solidity contract includes owner-guarded rescue methods and safe ERC20 call wrappers.

> **Important:** This project should be audited and hardened before mainnet production use.

---

## Documentation Index

- [Architecture](docs/ARCHITECTURE.md)
- [Frontend Guide](docs/FRONTEND.md)
- [API Contract](docs/API_CONTRACT.md)
- [Smart Contracts](docs/SMART_CONTRACTS.md)
- [Roadmap](docs/ROADMAP.md)
- [Demo Script](docs/DEMO.md)
- [Contributing](docs/CONTRIBUTING.md)

---

## Competitive Edge Narrative (Hackathon Positioning)

BridgX differentiates by combining:
- **BTC-native mental model** (`amountSats` first, not token-unit confusion),
- **Simple bridge UX** (single-screen quote + intent),
- **Composable backend architecture** (provider abstraction + quote orchestration),
- **On-chain enforceable execution primitive** (SourceExecutor),
- **Roadmap-ready architecture** for relayers, intents, and zero-friction chain expansion.

---

## Disclaimer

This repository is provided for educational, prototyping, and hackathon demonstration purposes. It is **not financial advice** and should not be used with significant funds without independent security review and operational hardening.
