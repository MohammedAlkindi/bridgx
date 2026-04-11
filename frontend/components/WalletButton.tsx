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

  return (
    <button
      type="button"
      onClick={isConnected ? onDisconnect : onConnect}
      disabled={disabled || isConnecting}
      aria-busy={isConnecting}
      aria-label={isConnected ? "Disconnect wallet" : "Connect wallet"}
      className={[
        "inline-flex min-w-[9rem] items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium",
        "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7931A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090e1f]",
        isConnected
          ? "border-[#4c5f9d] bg-[#1a2d5a] text-[#e2e8ff] hover:bg-[#243870]"
          : "border-[#F7931A] bg-[#F7931A] text-white hover:bg-[#e28512]",
        disabled || isConnecting ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isConnected && (
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
      )}
      {isConnecting && (
        <svg className="h-3.5 w-3.5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {getLabel(status, address)}
    </button>
  );
}
