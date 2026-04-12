# API Contract (as implemented)

Base URL (local default used in docs): `http://localhost:4000`

> Note: frontend defaults to `http://localhost:8001` unless `NEXT_PUBLIC_API_BASE_URL` is set.

## Endpoints

## `POST /quote`

Builds a two-leg quote:
1) source BTC-like token -> source USDC
2) destination USDC -> destination BTC-like token

Input:
```json
{
  "sourceChain": "avalanche",
  "destinationChain": "arbitrum",
  "sourceToken": "BTCB",
  "destinationToken": "WBTC",
  "amountSats": "100000",
  "walletAddress": "0x0000000000000000000000000000000000000000"
}
```

Output shape:
```json
{
  "quoteId": "uuid",
  "sourceChain": "avalanche",
  "destinationChain": "arbitrum",
  "sourceAmountSats": "100000",
  "destinationAmountSats": "...",
  "estimatedDurationSec": 90,
  "routeExpiresAt": "ISO-8601"
}
```

Notes:
- Stores leg-1 Odos quote + metadata in SQLite (`quote_store`) keyed by `quoteId`.
- Requires source chain to have configured `SourceExecutor`; defaults include Avalanche only.

## `POST /provider/quote`

Single-hop Odos quote helper.

Input fields:
- `amount_in` (decimal)
- `token_in` / `token_out` with `address|symbol`, `chain_id`, `decimals`
- `wallet_address` (optional)
- `slippage_perc` (optional)

Returns: output token amount as `float`.

## `POST /assemble`

Converts stored `quoteId` into executable tx calldata for `SourceExecutor.executeSwapAndBurn`.

Request:
```json
{
  "quote_id": "uuid",
  "wallet_address": "0x..."
}
```

Returns transaction object:
- `to`
- `data`
- `value`
- `chainId`

## `POST /output-amount`

Generic two-hop output estimator for explicit token path.
Returns destination amount as `float`.

## `POST /provider/token-price`
## `POST /token-price`
## `GET /token-price`

Token USD price via Odos pricing endpoint, with 60-second in-memory cache in backend.

## `GET /tokens`

Returns token registry entries currently hardcoded in `backend/libs/token.py`.

## `GET /networks`

Returns:
- avalanche (43114)
- base (8453)
- arbitrum (42161)

## `GET /token-balance`

Query params:
- `token_address`
- `wallet_address`
- `chain_id`

Uses direct `eth_call(balanceOf)` against chain RPC URL map in backend.

## `POST /swap-intent`

Stores destination execution intent keyed by source tx hash. This endpoint is used by the main `/` flow after the source transaction is submitted and before attestation polling.

Request fields (snake_case):
- `source_tx_hash`
- `destination_chain`
- `recipient`
- `token_address`
- `token_decimals`

Response:
```json
{
  "status": "ok"
}
```

## `POST /attestation`

Flow:
1. Reads source tx receipt.
2. Extracts `MessageSent` from source chain `MessageTransmitter` (or Circle Iris v2 messages endpoint).
3. Polls Circle Iris attestation API until attestation is available.
4. Submits `receiveMessage` tx on destination chain using relayer key.
5. Uses previously stored `/swap-intent` data to either `releaseUsdc` or call destination `executeSwapAndTransfer`.

Request fields (snake_case):
- `source_tx_hash`
- `source_chain`
- `destination_chain`
- `poll_attempts` (optional)
- `poll_interval_s` (optional)

Response highlights:
- `status`: `pending` or `complete`
- `messageHash`
- `destinationTxHash`
- optional release/swap progress fields: `releaseStatus`, `releaseTxHash`, `swapStatus`, `swapTxHash`

## `POST /receipt`

Request:
```json
{
  "tx_hash": "0x...",
  "chain": "base"
}
```

Response status:
- `pending`
- `confirmed`
- `failed`

## Not implemented but referenced by frontend types/pages

These routes are called by `frontend/lib/api.ts` and `/bridge/[id]`, but backend does not define them:
- `POST /bridge/initiate`
- `GET /bridge/{transferId}/status`
- `GET /bridge/{transferId}/receipt`
- `GET /btc-price`

In non-production frontend mode, these calls fall back to mock data.

## Error patterns

Common status codes used in handlers:
- `400` invalid chain/configuration/address
- `404` missing stored quote (`/assemble`)
- `422` schema validation error
- `502` upstream/provider/RPC failures
- `500` unexpected errors (notably in `/attestation`)
