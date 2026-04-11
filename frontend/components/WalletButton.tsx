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
  if (status === "connecting") {
    return "Connecting...";
  }

  if (status === "connected") {
    return address ? shortenWalletAddress(address) : "Wallet connected";
  }

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
        "inline-flex min-w-[10rem] items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium",
        "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7931A] focus-visible:ring-offset-2",
        isConnected
          ? "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100"
          : "border-[#F7931A] bg-[#F7931A] text-white hover:bg-[#e28512]",
        disabled || isConnecting ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {getLabel(status, address)}
    </button>
  );
}
