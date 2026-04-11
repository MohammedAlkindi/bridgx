# Demo Script

## Goal

Show a user-friendly BTC bridge experience from quote to transfer tracking.

## Prerequisites

- Frontend running on `http://localhost:3000`
- Backend running on `http://localhost:4000`
- MetaMask installed
- (Optional) mock mode enabled for fully offline demo stability

## 5-Minute Demo Narrative

1. **Open BridgX landing page**
   - Explain value proposition: BTC value mobility across L2s.

2. **Connect wallet**
   - Click connect and approve account access.

3. **Configure transfer**
   - Source: Base
   - Destination: Arbitrum
   - Amount: `100000` sats
   - Recipient: valid EVM address

4. **Show live quote behavior**
   - Highlight debounce and updated destination sats/ETA.
   - Mention expiration window and fast reroute potential.

5. **Initiate bridge**
   - Click Bridge CTA.
   - Navigate to transfer page and explain status progression model.

6. **Wrap with architecture confidence**
   - Backend quote orchestration.
   - On-chain execution primitive.
   - Roadmap to production orchestration and monitoring.

## Judge-Focused Soundbites

- "BTC-denominated UX removes cognitive tax."
- "Composable architecture: frontend intent, backend route intelligence, on-chain enforceability."
- "Production path is clear: orchestration APIs, relayer workers, and audited contracts."
