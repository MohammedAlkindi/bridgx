# Roadmap

This file distinguishes current implementation from planned work.

## Current baseline (implemented)

- Next.js bridge UI with MetaMask integration.
- FastAPI quote/assemble/swap-intent/attestation/receipt endpoints.
- Odos quote + assemble integration.
- Source-side `SourceExecutor` contract for swap-and-burn path.
- SQLite-backed temporary quote storage.

## Next priorities (not yet implemented in repository)

1. **Transfer lifecycle APIs**
   - Implement backend:
     - `POST /bridge/initiate`
     - `GET /bridge/{transferId}/status`
     - `GET /bridge/{transferId}/receipt`
   - Replace current frontend mock fallback for `/bridge/[id]` tracking path.

2. **Operational reliability**
   - Move attestation polling out of request thread into worker/queue model.
   - Add retry/idempotency strategy for destination relay transaction submission.
   - Add structured logging/metrics.

3. **Configuration hardening**
   - Explicit per-network `SourceExecutor` configuration beyond Avalanche.
   - Validate CCTP/TokenMessenger addresses via deployment-specific config.

4. **Testing expansion**
   - Add attestation/receipt integration tests with controlled mocks.
   - Add frontend integration/e2e tests for bridge happy path and failures.
   - Add Solidity test suite outside notebooks.

5. **Security and release readiness**
   - Add auth/rate-limit strategy for public API deployment.
   - External contract + relayer security review.
