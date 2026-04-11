export type WalletConnectionStatus = "disconnected" | "connecting" | "connected";

export interface WalletState {
  status: WalletConnectionStatus;
  address?: string;
}

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function isValidEvmAddress(address: string): boolean {
  return EVM_ADDRESS_REGEX.test(address.trim());
}

export async function connectMetaMask(): Promise<`0x${string}`> {
  if (typeof window === "undefined" || !("ethereum" in window)) {
    throw new Error("MetaMask is not installed. Please install the MetaMask browser extension.");
  }

  const ethereum = window.ethereum as {
    request: (args: { method: string }) => Promise<string[]>;
  };

  const accounts = await ethereum.request({ method: "eth_requestAccounts" });

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts returned from MetaMask.");
  }

  const address = accounts[0];
  if (!isValidEvmAddress(address)) {
    throw new Error("Invalid address returned from MetaMask.");
  }

  return address as `0x${string}`;
}

export async function requestWalletPermissions(): Promise<void> {
  if (typeof window === "undefined" || !("ethereum" in window)) {
    return;
  }

  const ethereum = window.ethereum as {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };

  try {
    await ethereum.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    // Ignore if the wallet does not support permissions prompt.
  }
}

export async function disconnectMetaMask(): Promise<void> {
  if (typeof window === "undefined" || !("ethereum" in window)) {
    return;
  }

  const ethereum = window.ethereum as {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };

  try {
    await ethereum.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    // Ignore if the wallet does not support permissions revoke.
  }
}

export function shortenWalletAddress(address: string, start = 6, end = 4): string {
  const trimmedAddress = address.trim();

  if (!isValidEvmAddress(trimmedAddress)) {
    return trimmedAddress;
  }

  const maxVisibleChars = start + end + 3;
  if (trimmedAddress.length <= maxVisibleChars) {
    return trimmedAddress;
  }

  return `${trimmedAddress.slice(0, start)}...${trimmedAddress.slice(-end)}`;
}

export function createDemoWalletState(address?: string): WalletState {
  if (!address) {
    return { status: "disconnected" };
  }

  if (!isValidEvmAddress(address)) {
    return { status: "disconnected" };
  }

  return {
    status: "connected",
    address,
  };
}
