# Smart contracts

## `solidity/SourceExecutor.sol`

Single contract in repository: `SourceExecutor` (Solidity `^0.8.19`).

### Constructor immutables

- `owner` (deployer)
- `odosRouter`
- `usdc`
- `tokenMessenger`

All must be non-zero or deployment reverts with `ZeroAddress`.

### `executeSwapAndBurn(...)`

Implemented behavior:
1. Rejects native value (`msg.value != 0` -> `NativeValueNotAllowed`).
2. Pulls `inputToken` from caller via `transferFrom`.
3. Approves Odos router (`approve(0)` then `approve(amountIn)`).
4. Executes Odos calldata with low-level `call`.
5. Measures `usdcOut` as post-balance minus pre-balance.
6. Reverts if `usdcOut == 0`.
7. Approves TokenMessenger for `usdcOut`.
8. Calls `depositForBurnWithHook`.
9. Emits `SwapAndBurnExecuted`.

### Admin recovery methods

- `rescueToken(token, to, amount)` - owner only
- `rescueNative(to, amount)` - owner only

Both validate recipient and emit events.

### ERC20 safety helpers used

- `_callOptionalReturn` style low-level token call handling.
- Explicit revert for call failure or boolean false return.
- Force-approve pattern for compatibility with tokens requiring approve reset.

## What is not present in this repo

- No Foundry/Hardhat project scaffolding.
- No Solidity unit/invariant test suite in `.sol` test form.
- Only Jupyter notebooks are provided for deployment/e2e experiments.
