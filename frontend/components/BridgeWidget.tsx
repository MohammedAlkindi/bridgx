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
  onSourceChainChange: (chain: SupportedChain) => void;
  onDestinationChainChange: (chain: SupportedChain) => void;
  onAmountSatsChange: (amount: string) => void;
  onRecipientAddressChange: (address: string) => void;
  onSubmit: () => void;
};

function formatChainLabel(chain: SupportedChain): string {
  return chain.charAt(0).toUpperCase() + chain.slice(1);
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
  onSourceChainChange,
  onDestinationChainChange,
  onAmountSatsChange,
  onRecipientAddressChange,
  onSubmit,
}: BridgeWidgetProps) {
  const isSubmitDisabled = loading || !canSubmit;

  return (
    <section className="w-full max-w-xl rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900">Bridge BTC</h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="source-chain" className="mb-1 block text-sm font-medium text-neutral-700">
            Source chain
          </label>
          <select
            id="source-chain"
            value={sourceChain}
            onChange={(event) => onSourceChainChange(event.target.value as SupportedChain)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#F7931A] focus:outline-none focus:ring-2 focus:ring-[#F7931A]/30"
          >
            {chainOptions.map((chain) => (
              <option key={chain} value={chain}>
                {formatChainLabel(chain)}
              </option>
            ))}
          </select>
          {fieldErrors?.sourceChain ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.sourceChain}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="destination-chain" className="mb-1 block text-sm font-medium text-neutral-700">
            Destination chain
          </label>
          <select
            id="destination-chain"
            value={destinationChain}
            onChange={(event) => onDestinationChainChange(event.target.value as SupportedChain)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#F7931A] focus:outline-none focus:ring-2 focus:ring-[#F7931A]/30"
          >
            {chainOptions.map((chain) => (
              <option key={chain} value={chain}>
                {formatChainLabel(chain)}
              </option>
            ))}
          </select>
          {fieldErrors?.destinationChain ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.destinationChain}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="amount-sats" className="mb-1 block text-sm font-medium text-neutral-700">
            BTC amount (sats)
          </label>
          <input
            id="amount-sats"
            type="text"
            inputMode="numeric"
            placeholder="100000"
            value={amountSats}
            onChange={(event) => onAmountSatsChange(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#F7931A] focus:outline-none focus:ring-2 focus:ring-[#F7931A]/30"
          />
          {fieldErrors?.amountSats ? <p className="mt-1 text-xs text-red-600">{fieldErrors.amountSats}</p> : null}
        </div>

        <div>
          <label htmlFor="recipient-address" className="mb-1 block text-sm font-medium text-neutral-700">
            Recipient address
          </label>
          <input
            id="recipient-address"
            type="text"
            placeholder="0x..."
            value={recipientAddress}
            onChange={(event) => onRecipientAddressChange(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#F7931A] focus:outline-none focus:ring-2 focus:ring-[#F7931A]/30"
          />
          {fieldErrors?.recipientAddress ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.recipientAddress}</p>
          ) : null}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
          <p className="font-medium text-neutral-900">Quote</p>
          {quote ? (
            <div className="mt-1 space-y-1">
              <p>Input: {quote.sourceAmountSats} sats</p>
              <p>Estimated received: {quote.destinationAmountSats} sats</p>
              <p>ETA: {Math.ceil(quote.estimatedDurationSec / 60)} min</p>
              {quote.routeExpiresAt ? <p>Expires: {quote.routeExpiresAt}</p> : null}
            </div>
          ) : (
            <p className="mt-1 text-neutral-500">Enter transfer details to view a quote.</p>
          )}
        </div>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitDisabled}
          aria-busy={loading}
          className="w-full rounded-lg bg-[#F7931A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e28512] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Processing..." : ctaLabel}
        </button>
      </div>
    </section>
  );
}
