import type { SupportedChain, TokenInfo } from "../types";

type QuoteView = {
  sourceAmountSats: string;
  destinationAmountSats: string;
  estimatedDurationSec: number;
  routeExpiresAt?: string;
};

type BridgeWidgetProps = {
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  sourceToken: string;
  destinationToken: string;
  amountSats: string;
  chainOptions: readonly SupportedChain[];
  sourceTokenOptions: readonly TokenInfo[];
  destinationTokenOptions: readonly TokenInfo[];
  quote?: QuoteView;
  ctaLabel?: string;
  ctaVariant?: "green" | "orange";
  loading?: boolean;
  canSubmit?: boolean;
  fieldErrors?: Partial<Record<"sourceChain" | "destinationChain" | "amountSats", string>>;
  /** Neutral message — wallet not connected, form guidance, etc. */
  infoMessage?: string;
  /** Error message — quote failure, bridge error, etc. */
  errorMessage?: string;
  walletBalanceTokens?: string;
  tokenUsdPrice?: number;
  destinationTokenUsdPrice?: number;
  onRefreshQuote: () => void;
  canRefresh?: boolean;
  isWalletConnected?: boolean;
  onSourceChainChange: (chain: SupportedChain) => void;
  onDestinationChainChange: (chain: SupportedChain) => void;
  onSourceTokenChange: (token: string) => void;
  onDestinationTokenChange: (token: string) => void;
  onAmountSatsChange: (amount: string) => void;
  onSwapChains: () => void;
  onSubmit: () => void;
};

const CHAIN_LABELS: Record<SupportedChain, string> = {
  avalanche: "Avalanche",
  base: "Base",
  arbitrum: "Arbitrum",
};

/** Network brand colors — used for the chain indicator dot */
const CHAIN_COLORS: Record<SupportedChain, string> = {
  avalanche: "#e84142",
  base: "#0052ff",
  arbitrum: "#28a0f0",
};

function tokenToUsd(amount: number, usdPerToken: number): string {
  return (amount * usdPerToken).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatTokenLabel(token: TokenInfo): string {
  return token.symbol ?? token.name ?? token.address;
}

function formatScaledAmount(amountScaled: string): string {
  if (!amountScaled) return "0";
  try {
    const raw = BigInt(amountScaled);
    const scale = 100000000n;
    const whole = raw / scale;
    const fraction = raw % scale;
    if (fraction === 0n) return whole.toString();
    let fractionStr = fraction.toString().padStart(8, "0").replace(/0+$/, "");
    if (fractionStr.length > 6) {
      fractionStr = fractionStr.slice(0, 6);
    }
    return `${whole}.${fractionStr}`;
  } catch {
    return amountScaled;
  }
}

export default function BridgeWidget({
  sourceChain,
  destinationChain,
  sourceToken,
  destinationToken,
  amountSats,
  chainOptions,
  sourceTokenOptions,
  destinationTokenOptions,
  quote,
  ctaLabel = "Bridge BTC",
  ctaVariant = "green",
  loading = false,
  canSubmit = true,
  fieldErrors,
  infoMessage,
  errorMessage,
  walletBalanceTokens,
  tokenUsdPrice,
  destinationTokenUsdPrice,
  onRefreshQuote,
  canRefresh = true,
  isWalletConnected = false,
  onSourceChainChange,
  onDestinationChainChange,
  onSourceTokenChange,
  onDestinationTokenChange,
  onAmountSatsChange,
  onSwapChains,
  onSubmit,
}: BridgeWidgetProps) {
  const isSubmitDisabled = isWalletConnected ? loading || !canSubmit : !canSubmit;
  const amountNum = Number(amountSats);
  const showUsd = tokenUsdPrice !== undefined;
  const amountUsd = showUsd && amountSats && Number.isFinite(amountNum) && amountNum > 0
    ? tokenToUsd(amountNum, tokenUsdPrice!)
    : null;
  const destinationQuoteUsd =
    quote && destinationTokenUsdPrice !== undefined
      ? tokenToUsd(Number(formatScaledAmount(quote.destinationAmountSats)), destinationTokenUsdPrice)
      : null;
  const sourceChainLabel = CHAIN_LABELS[sourceChain];
  const destinationChainLabel = CHAIN_LABELS[destinationChain];
  const amountInLabel = sourceToken
    ? `You send (${sourceToken} / ${sourceChainLabel})`
    : `You send (${sourceChainLabel})`;
  const receiveLabel = `You receive on ${destinationChainLabel}`;
  const isRefreshDisabled = !canRefresh || loading;
  const ctaClasses =
    ctaVariant === "orange"
      ? "bg-[#F7931A] hover:bg-[#e28512] active:bg-[#cc7810]"
      : "bg-emerald-400 hover:bg-emerald-500 active:bg-emerald-600";
  const accentTextClass = isWalletConnected ? "text-emerald-400" : "text-[#F7931A]";
  const accentTextMutedClass = isWalletConnected ? "text-emerald-700" : "text-[#cc7810]";
  const refreshHoverClass = isWalletConnected ? "hover:text-emerald-300" : "hover:text-[#ffb347]";
  const swapAccentClass = "text-[#3d5070] border-[#1e2d5a] opacity-60";

  return (
    <section className="w-full rounded-2xl border border-[#1e2a4a] bg-[#0f1630] shadow-xl" style={{ overflow: "hidden" }}>

      {/* ── Chain selectors ──────────────────────────────────────── */}
      <div className="p-5 pb-4">
        <div className="grid grid-cols-[1fr_40px_1fr] items-end gap-2">
          {/* From */}
          <div>
            <label
              htmlFor="source-chain"
              className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#5a6d9a]"
            >
              From
            </label>
            <select
              id="source-chain"
              value={sourceChain}
              onChange={(e) => onSourceChainChange(e.target.value as SupportedChain)}
              className="w-full rounded-lg border border-[#1e2d5a] bg-[#090e1f] px-3 py-2.5 text-sm text-[#e2e8ff] focus:border-[#F7931A] focus:outline-none focus:ring-2 focus:ring-[#F7931A]/20"
            >
              {chainOptions.map((chain) => (
                <option
                  key={chain}
                  value={chain}
                  disabled={chain === destinationChain || chain === "base" || chain === "arbitrum"}
                >
                  {CHAIN_LABELS[chain]}
                </option>
              ))}
            </select>
            {fieldErrors?.sourceChain && (
              <p className="mt-1 text-[11px] text-red-400">{fieldErrors.sourceChain}</p>
            )}
          </div>

          {/* Swap button */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={onSwapChains}
              disabled
              aria-label="Swap source and destination chains"
              title="Swap chains"
              className={[
                "inline-flex items-center justify-center w-[38px] h-[38px] rounded-[8px] border border-[#1e2d5a] bg-[#090e1f] text-[14px] transition-colors cursor-pointer",
                swapAccentClass,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              ⇄
            </button>
          </div>

          {/* To */}
          <div>
            <label
              htmlFor="destination-chain"
              className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#5a6d9a]"
            >
              To
            </label>
            <select
              id="destination-chain"
              value={destinationChain}
              onChange={(e) => onDestinationChainChange(e.target.value as SupportedChain)}
              className="w-full rounded-lg border border-[#1e2d5a] bg-[#090e1f] px-3 py-2.5 text-sm text-[#e2e8ff] focus:border-[#F7931A] focus:outline-none focus:ring-2 focus:ring-[#F7931A]/20"
            >
              {chainOptions.map((chain) => (
                <option key={chain} value={chain} disabled={chain === sourceChain || chain === "arbitrum"}>
                  {CHAIN_LABELS[chain]}
                </option>
              ))}
            </select>
            {fieldErrors?.destinationChain && (
              <p className="mt-1 text-[11px] text-red-400">{fieldErrors.destinationChain}</p>
            )}
          </div>
        </div>

      {/* Token selectors */}
      <div className="mt-4 grid grid-cols-[1fr_40px_1fr] items-end gap-2">
        <div>
          <label htmlFor="source-token" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#5a6d9a]">
            You send
          </label>
          <select
            id="source-token"
            value={sourceToken}
            onChange={(e) => onSourceTokenChange(e.target.value)}
            disabled={sourceTokenOptions.length === 0}
            className="w-full rounded-lg border border-[#1e2d5a] bg-[#090e1f] px-3 py-2.5 text-sm text-[#e2e8ff] focus:border-[#F7931A] focus:outline-none focus:ring-2 focus:ring-[#F7931A]/20 disabled:opacity-60"
          >
            {sourceTokenOptions.length === 0 ? (
              <option value="">No tokens</option>
            ) : (
              sourceTokenOptions.map((token) => (
                <option key={`${token.chain_id}-${token.address}`} value={formatTokenLabel(token)}>
                  {formatTokenLabel(token)}
                </option>
              ))
            )}
          </select>
        </div>
        <div />
        <div>
          <label htmlFor="destination-token" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#5a6d9a]">
            Token out
          </label>
          <select
            id="destination-token"
            value={destinationToken}
            onChange={(e) => onDestinationTokenChange(e.target.value)}
            disabled={destinationTokenOptions.length === 0}
            className="w-full rounded-lg border border-[#1e2d5a] bg-[#090e1f] px-3 py-2.5 text-sm text-[#e2e8ff] focus:border-[#F7931A] focus:outline-none focus:ring-2 focus:ring-[#F7931A]/20 disabled:opacity-60"
          >
            {destinationTokenOptions.length === 0 ? (
              <option value="">No tokens</option>
            ) : (
              destinationTokenOptions.map((token) => (
                <option key={`${token.chain_id}-${token.address}`} value={formatTokenLabel(token)}>
                  {formatTokenLabel(token)}
                </option>
              ))
            )}
          </select>
        </div>
      </div>
    </div>

      {/* Divider */}
      <div className="border-t border-[#121d3a]" />

      {/* ── Amount + Recipient ───────────────────────────────────── */}
      <div className="p-5 pt-4 space-y-4">
        {/* Amount */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="amount-sats" className="block text-[11px] font-semibold uppercase tracking-wider text-[#5a6d9a]">
              {amountInLabel}
            </label>
          </div>
          <div className="relative">
            <input
              id="amount-sats"
              type="text"
              inputMode="numeric"
              placeholder="100000"
              value={amountSats}
              onChange={(e) => onAmountSatsChange(e.target.value)}
              className="w-full rounded-lg border border-[#1e2d5a] bg-[#090e1f] py-2.5 pl-3 pr-24 text-sm text-[#e2e8ff] placeholder-[#3d5070] focus:border-[#F7931A] focus:outline-none focus:ring-2 focus:ring-[#F7931A]/20"
            />
            <div className="absolute inset-y-0 right-3 flex items-center gap-2">
              {walletBalanceTokens !== undefined && (
                <button
                  type="button"
                  onClick={() => onAmountSatsChange(String(walletBalanceTokens))}
                  className="text-[10px] font-bold leading-none px-1.5 py-0.5 rounded border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                >
                  MAX
                </button>
              )}
              <span className="text-xs font-medium text-[#4a5a8a]">{sourceToken || "token"}</span>
            </div>
          </div>

          {/* USD + Balance */}
          <div className="mt-1.5 flex items-center justify-between text-xs">
            {amountUsd ? (
              <span className="text-[#5a6d9a]">≈ {amountUsd}</span>
            ) : (
              <span />
            )}
            {walletBalanceTokens !== undefined ? (
              <span className="text-[#3d5070]">
                Balance:{" "}
                <span className="text-[#5a6d9a]">
                  {walletBalanceTokens} {sourceToken || ""}
                </span>
                {showUsd && walletBalanceTokens && (
                  <span className="text-[#3d5070]">
                    {" "}
                    ≈ {tokenToUsd(Number(walletBalanceTokens), tokenUsdPrice!)}
                  </span>
                )}
              </span>
            ) : (
              <span />
            )}
          </div>

          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              onClick={onRefreshQuote}
              disabled={isRefreshDisabled}
              aria-label="Update the quote"
              title="Update the quote"
              className={[
                `inline-flex items-center justify-center rounded-full p-1 ${accentTextClass}`,
                isRefreshDisabled ? "cursor-not-allowed opacity-50" : `cursor-pointer ${refreshHoverClass}`,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <svg
                className={["h-7 w-7", loading ? "animate-spin" : ""].filter(Boolean).join(" ")}
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M4.5 10.5a7.5 7.5 0 0112.78-5.03L19.5 7.5m0 0V3m0 4.5h-4.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M19.5 13.5a7.5 7.5 0 01-12.78 5.03L4.5 16.5m0 0V21m0-4.5h4.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {fieldErrors?.amountSats && (
            <p className="mt-1 text-[11px] text-red-400">{fieldErrors.amountSats}</p>
          )}
        </div>

      </div>

      {/* Divider */}
      <div className="border-t border-[#121d3a]" />

      {/* ── Quote panel ──────────────────────────────────────────── */}
      <div className="px-5 pb-5 pt-2">
        <div className="rounded-xl border border-[#121d3a] bg-[#090e1f] overflow-hidden">
          {quote ? (
            <div className="divide-y divide-[#121d3a]">
              <div className="flex justify-between items-center px-4 py-2.5">
                <span className="text-sm text-[#5a6d9a]">{receiveLabel}</span>
                <span className={`text-sm font-medium ${accentTextClass}`}>
                  {formatScaledAmount(quote.destinationAmountSats)} {destinationToken || ""}
                  {destinationQuoteUsd && (
                    <span className={`ml-1.5 text-xs ${accentTextMutedClass}`}>
                      ({destinationQuoteUsd})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5">
                <span className="text-sm text-[#5a6d9a]">Estimated time</span>
                <span className="text-sm font-medium text-[#e2e8ff]">~10 sec</span>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#0d1428]">
              {[receiveLabel, "Estimated time"].map((row) => (
                <div key={row} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-[#1e2d4a]">{row}</span>
                  <span className="text-sm text-[#1e2d4a]">—</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Info / Error messages ────────────────────────────────── */}
      {infoMessage && (
        <div className="mx-5 mb-4 -mt-1 rounded-lg border border-[#1a2240] bg-[#090e1f] px-4 py-2.5 text-sm text-[#5a6d9a] leading-snug">
          {infoMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mx-5 mb-4 -mt-1 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-2.5 text-sm text-red-400 leading-snug">
          {errorMessage}
        </div>
      )}

      {/* ── Submit button ────────────────────────────────────────── */}
      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitDisabled}
          aria-busy={loading && isWalletConnected}
          className={[
            "w-full rounded-xl px-4 py-3.5 text-[15px] font-semibold text-white transition-colors",
            ctaClasses,
            "disabled:cursor-not-allowed disabled:opacity-40",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {loading && isWalletConnected ? (
            <span className="inline-flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Updating quotes...
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              {ctaLabel}
            </span>
          )}
        </button>
      </div>
    </section>
  );
}
