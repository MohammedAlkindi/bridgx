# Contributing

## Local setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api:app --reload --port 4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Recommended frontend env file:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_USE_MOCK_API=false
```

## Running tests/checks

Backend tests:

```bash
cd backend
pytest
```

Frontend has no configured test script in `package.json` at the time of writing.

## Contribution scope guidance

High-impact contribution areas based on current gaps:
- Implement backend `/bridge/*` lifecycle endpoints used by `frontend/app/bridge/[id]/page.tsx`.
- Add coverage for `/swap-intent` + `/attestation` interaction and swap-intent SQLite TTL behavior.
- Improve consistency between amount units in frontend input/labeling and backend request fields.
- Add integration tests for `/attestation` and `/receipt` behavior.
- Add Solidity test project (Foundry/Hardhat) for `SourceExecutor`.

## PR expectations

Include in your PR:
- Summary of behavior changes.
- Exact API/contract/UI surfaces affected.
- Commands run for verification and their outcomes.
- Documentation updates when behavior changes.
