import type { SupportedChain } from "../types";

type QuoteView = {
  sourceAmountSats: string;
  destinationAmountSats: string;
  estimatedDurationSec: number;
  routeExpiresAt?: string;
};

type BridgeWidgetProps = {
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  amountSats: string;
  recipientAddress: string;
  chainOptions: readonly SupportedChain[];
  quote?: QuoteView;
  ctaLabel?: string;
  loading?: boolean;
  canSubmit?: boolean;
  fieldErrors?: Partial<Record<"sourceChain" | "destinationChain" | "amountSats" | "recipientAddress", string>>;
  errorMessage?: string;
  walletBalanceSats?: number;
  usdRate?: number;
  onSourceChainChange: (chain: SupportedChain) => void;
  onDestinationChainChange: (chain: SupportedChain) => void;
  onAmountSatsChange: (amount: string) => void;
  onRecipientAddressChange: (address: string) => void;
  onSwapChains: () => void;
  onSubmit: () => void;
};

const CHAIN_LABELS: Record<SupportedChain, string> = {
  base: "Base",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
};

function formatExpiry(iso: string): string {
  const diff = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
  if (diff <= 0) return "Expired";
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function satsToUsd(sats: number, usdPerBtc: number): string {
  return (sats / 1e8 * usdPerBtc).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export default function BridgeWidget({
  sourceChain,
  destinationChain,
  amountSats,
  recipientAddress,
  chainOptions,
  quote,
  ctaLabel = "Bridge BTC",
  loading = false,
  canSubmit = true,
  fieldErrors,
  errorMessage,
  walletBalanceSats,
  usdRate,
  onSourceChainChange,
  onDestinationChainChange,
  onAmountSatsChange,
  onRecipientAddressChange,
  onSwapChains,
  onSubmit,
}: BridgeWidgetProps) {
  const isSubmitDisabled = loading || !canSubmit;

  const amountNum = Number(amountSats);
  const amountUsd = usdRate && amountSats && Number.isFinite(amountNum) && amountNum > 0
    ? satsToUsd(amountNum, usdRate)
    : null;

  const balanceUsd = usdRate && walletBalanceSats !== undefined
    ? satsToUsd(walletBalanceSats, usdRate)
    : null;

  return (
    <section className="w-full rounded-2xl border border-[#29335a] bg-[#121937] p-6 shadow-xl">
      {/* Chain selectors */}
      <div className="grid grid-cols-[1fr_36px_1fr] items-end gap-2">
        <div>
          <label htmlFor="source-chain" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6b7db3]">
            From
          </label>
          <select
            id="source-chain"
            value={sourceChain}
            onChange={(e) => onSourceChainChange(e.target.value as SupportedChain)}
            className="w-full rounded-lg border border-[#263360] bg-[#0f1632] px-3 py-2.5 text-sm text-[#e2e8ff] focus:border-[#F7931A] focus:outline-none focus:ring-2 focus:ring-[#F7931A]/20"
          >
            {chainOptions.map((chain) => (
              <option key={chain} value={chain}>{CHAIN_LABELS[chain]}</option>
            ))}
          </select>
          {fieldErrors?.sourceChain && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.sourceChain}</p>
          )}
        </div>

        {/* Swap button */}
        <div className="flex justify-center pb-[11px]">
          <button
            type="button"
            onClick={onSwapChains}
            aria-label="Swap chains"
            title="Swap chains"
            className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-[7px] border border-[#1e2d5a] bg-[#0d1326] text-[#4a5a8a] text-[15px] hover:border-[#F7931A] hover:text-[#F7931A] transition-colors cursor-pointer"
          >
            ⇄
          </button>
        </div>

        <div>
          <label htmlFor="destination-chain" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6b7db3]">
            To
          </label>
          <select
            id="destination-chain"
            value={destinationChain}
            onChange={(e) => onDestinationChainChange(e.target.value as SupportedChain)}
            className="w-full rounded-lg border border-[#263360] bg-[#0f1632] px-3 py-2.5 text-sm text-[#e2e8ff] focus:border-[#F7931A] focus:outline-none focus:ring-2 focus:ring-[#F7931A]/20"
          >
            {chainOptions.map((chain) => (
              <option key={chain} value={chain}>{CHAIN_LABELS[chain]}</option>
            ))}
          </select>
          {fieldErrors?.destinationChain && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.destinationChain}</p>
          )}
        </div>
      </div>

      {/* Amount input */}
      <div className="mt-4">
        <label htmlFor="amount-sats" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6b7db3]">
          Amount (satoshis)
        </label>
        <div className="relative">
          <input
            id="amount-sats"
            type="text"
            inputMode="numeric"
            placeholder="100000"
            value={amountSats}
            onChange={(e) => onAmountSatsChange(e.target.value)}
            className="w-full rounded-lg border border-[#263360] bg-[#0f1632] py-2.5 pl-3 pr-24 text-sm text-[#e2e8ff] placeholder-[#4a5a8a] focus:border-[#F7931A] focus:outline-none focus:ring-2 focus:ring-[#F7931A]/20"
          />
          <div className="absolute inset-y-0 right-3 flex items-center gap-2">
            {walletBalanceSats !== undefined && (
              <button
                type="button"
                onClick={() => onAmountSatsChange(String(walletBalanceSats))}
                className="text-[10px] font-bold leading-none px-1.5 py-0.5 rounded border border-[#F7931A]/40 text-[#F7931A] hover:bg-[#F7931A]/10 transition-colors"
              >
                MAX
              </button>
            )}
            <span className="text-xs font-medium text-[#6b7db3]">sats</span>
          </div>
        </div>

        {/* Balance + USD hint */}
        <div className="mt-1.5 flex items-center justify-between text-xs">
          {walletBalanceSats !== undefined ? (
            <span className="text-[#4a5a8a]">
              Balance: <span className="text-[#6b7db3]">{walletBalanceSats.toLocaleString()} sats</span>
              {balanceUsd && <span className="text-[#4a5a8a]"> ≈ {balanceUsd}</span>}
            </span>
          ) : (
            <span />
          )}
          {amountUsd && (
            <span className="text-[#6b7db3]">≈ {amountUsd}</span>
          )}
        </div>

        {fieldErrors?.amountSats && (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.amountSats}</p>
        )}
      </div>

      {/* Recipient address */}
      <div className="mt-4">
        <label htmlFor="recipient-address" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6b7db3]">
          Recipient address
        </label>
        <input
          id="recipient-address"
          type="text"
          placeholder="0x..."
          value={recipientAddress}
          onChange={(e) => onRecipientAddressChange(e.target.value)}
          className="w-full rounded-lg border border-[#263360] bg-[#0f1632] px-3 py-2.5 font-mono text-sm text-[#e2e8ff] placeholder-[#4a5a8a] focus:border-[#F7931A] focus:outline-none focus:ring-2 focus:ring-[#F7931A]/20"
        />
        {fieldErrors?.recipientAddress && (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.recipientAddress}</p>
        )}
      </div>

      {/* Quote panel */}
      <div className="mt-6 rounded-xl border border-[#1e2d5a] bg-[#0d1326] p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7db3]">Live Quote</p>
        {quote ? (
          <div className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[#9eb3ff]">You send</span>
              <span className="font-medium text-[#e2e8ff]">
                {Number(quote.sourceAmountSats).toLocaleString()} sats
                {usdRate && <span className="ml-1.5 text-xs text-[#6b7db3]">({satsToUsd(Number(quote.sourceAmountSats), usdRate)})</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9eb3ff]">You receive</span>
              <span className="font-medium text-emerald-400">
                {Number(quote.destinationAmountSats).toLocaleString()} sats
                {usdRate && <span className="ml-1.5 text-xs text-emerald-600">({satsToUsd(Number(quote.destinationAmountSats), usdRate)})</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9eb3ff]">ETA</span>
              <span className="font-medium text-[#e2e8ff]">~{Math.ceil(quote.estimatedDurationSec / 60)} min</span>
            </div>
            {quote.routeExpiresAt && (
              <div className="flex justify-between border-t border-[#1e2d5a] pt-1.5">
                <span className="text-[#9eb3ff]">Quote expires in</span>
                <span className="font-medium text-amber-400">{formatExpiry(quote.routeExpiresAt)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {["You send", "You receive", "ETA"].map((row) => (
              <div key={row} className="flex items-center justify-between">
                <span className="text-sm text-[#2e3f6a]">{row}</span>
                <div className="h-px w-20 rounded-full bg-[#1a2748]" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error / info message */}
      {errorMessage && (
        <div className="mt-4 rounded-lg border border-[#1e2d5a] bg-[#0d1326] px-4 py-2.5 text-sm text-[#7a90b8] leading-snug">
          {errorMessage}
        </div>
      )}

      {/* Submit button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitDisabled}
        aria-busy={loading}
        className="mt-6 w-full rounded-xl bg-[#F7931A] px-4 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#e28512] active:bg-[#cc7810] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="inline-flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Processing…
          </span>
        ) : (
          <span className="inline-flex items-center justify-center gap-2">
            {ctaLabel}
            {!isSubmitDisabled && <span aria-hidden="true">→</span>}
          </span>
        )}
      </button>
    </section>
  );
}
