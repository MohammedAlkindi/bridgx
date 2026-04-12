# Contributing

## Local setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
uvicorn backend.api:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm run build
npm run start -- -p 3003
```

## Running tests/checks

Backend tests:

```bash
cd backend
pytest -q
```

## Contribution scope guidance

High-impact contribution areas:
- Add more networks by deploying the existing solidity contracts on them (both source and destination ones).
- Add more tokes: as easy as adding their addresses in different networks to the backend
- Adding more routing providers, like Velora and 1inch. Then the alrogithm should get quotes from all of them and choose the best route.
- Add fast tx method using CCTP protocol (not needed for Avalanche - it's already fast;)
- Add user-defined slippage. Currently it's hardcoded to 0.1%
- Retry if the second leg (dest network USDC -> X) fails. Alternative to return USDC on dest network 


## PR expectations

Include in your PR:
- Summary of behavior changes.
- Unit tests when applicable
