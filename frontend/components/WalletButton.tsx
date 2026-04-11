import { shortenWalletAddress, type WalletConnectionStatus } from "../lib/wallet";

type WalletButtonProps = {
  status: WalletConnectionStatus;
  address?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  className?: string;
  disabled?: boolean;
};

function getLabel(status: WalletConnectionStatus, address?: string): string {
  if (status === "connecting") return "Connecting…";
  if (status === "connected") return address ? shortenWalletAddress(address) : "Connected";
  return "Connect Wallet";
}

export default function WalletButton({
  status,
  address,
  onConnect,
  onDisconnect,
  className,
  disabled = false,
}: WalletButtonProps) {
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const isMainDisabled = disabled || isConnecting;
  const mainClasses = [
    "inline-flex min-w-[9rem] items-center justify-center gap-2 border px-4 py-2 text-sm font-medium",
    "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7931A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090e1f]",
    isConnected
      ? "border-[#1e2d5a] bg-[#090e1f] text-[#9eb3cc] hover:border-[#263360] hover:bg-[#0f1632]"
      : "border-[#F7931A] bg-[#F7931A] text-white hover:bg-[#e28512] active:bg-[#cc7810]",
    isConnected ? "rounded-l-lg rounded-r-none" : "rounded-lg",
    isMainDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="inline-flex items-stretch">
      <button
        type="button"
        onClick={isConnected ? undefined : onConnect}
        disabled={isMainDisabled}
        aria-busy={isConnecting}
        aria-label={isConnected ? `Wallet address ${address ?? ""}` : "Connect wallet"}
        title={isConnected && address ? address : undefined}
        className={mainClasses}
      >
        {isConnected && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
        )}
        {isConnecting && (
          <svg className="h-3.5 w-3.5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {getLabel(status, address)}
      </button>
      {isConnected && (
        <button
          type="button"
          onClick={onDisconnect}
          disabled={disabled}
          aria-label="Disconnect wallet"
          title="Disconnect wallet"
          className={[
            "inline-flex items-center justify-center border border-l-0 px-2",
            "rounded-r-lg text-xs font-semibold text-red-400",
            "border-[#1e2d5a] bg-[#090e1f] hover:border-red-500/70 hover:text-red-300",
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          X
        </button>
      )}
    </div>
  );
}
