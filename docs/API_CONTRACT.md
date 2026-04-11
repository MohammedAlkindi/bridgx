# API Contract (Current + Target)

Base URL (local): `http://localhost:4000`

## Implemented Endpoints

### `POST /quote`

Returns high-level bridge quote metadata.

Request:
```json
{
  "sourceChain": "base",
  "destinationChain": "arbitrum",
  "sourceToken": "BTC",
  "destinationToken": "BTC",
  "amountSats": "100000",
  "walletAddress": "0x..."
}
```

Response:
```json
{
  "quoteId": "uuid",
  "sourceChain": "base",
  "destinationChain": "arbitrum",
  "sourceAmountSats": "100000",
  "destinationAmountSats": "99500",
  "estimatedDurationSec": 90,
  "routeExpiresAt": "2026-04-11T00:00:00+00:00"
}
```

### `POST /provider/quote`

Low-level single-hop quote helper for a token pair.

### `POST /assemble`

Assembles provider transaction payload from a quote object and wallet address.

### `POST /output-amount`

Computes output amount for explicit two-hop path:
- token_in -> token_med_in
- token_med_out -> token_out

### `GET /btc-price`

Returns BTC/USD price with short cache.

## Target Endpoints (Planned)

Frontend types expect additional orchestration APIs:

- `POST /bridge/initiate`
- `GET /bridge/{transferId}/status`
- `GET /bridge/{transferId}/receipt`

These should become first-class endpoints in backend productionization.

## Error Semantics

- `400`: invalid chain/name combinations.
- `422`: request schema validation failure.
- `502`: upstream provider failure or incomplete provider payload.

## Notes for Integrators

- `amountSats` is a **string** for precision safety.
- `walletAddress` should be a checksummed EVM address.
- Quote expiry should be enforced client-side and server-side for execution safety.
