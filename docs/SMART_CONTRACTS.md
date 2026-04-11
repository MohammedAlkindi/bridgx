# Smart Contracts

## SourceExecutor.sol

`SourceExecutor` is the source-chain execution primitive responsible for:
1. Collecting input token from caller.
2. Executing Odos swap via provided calldata.
3. Measuring resulting USDC output.
4. Burning USDC through token messenger with hook data.

## Constructor Immutables

- `owner`
- `odosRouter`
- `usdc`
- `tokenMessenger`

All are set at deployment and immutable for gas efficiency and integrity.

## Primary Method

### `executeSwapAndBurn(...)`

Validations and flow:
- Rejects native ETH value.
- Pulls ERC20 input from user.
- Approves router and executes swap calldata.
- Requires non-zero USDC out.
- Approves token messenger.
- Calls `depositForBurnWithHook(...)`.
- Emits `SwapAndBurnExecuted` event.

## Admin Recovery Methods

- `rescueToken(token, to, amount)`
- `rescueNative(to, amount)`

Both are owner-gated and emit recovery events.

## Safety Patterns Used

- Optional-return-aware ERC20 wrapper calls.
- Force-approve pattern (approve 0 then approve amount).
- Custom errors for efficient revert signaling.

## Audit Checklist (Suggested)

- Validate assumptions on `odosData` calldata trust boundaries.
- Verify destination domain / caller invariants.
- Confirm no reentrancy-sensitive accounting assumptions.
- Ensure rescue functions align with governance policy.
- Add fuzz/invariant tests for malformed token behavior.
