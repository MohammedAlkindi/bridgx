export type WalletConnectionStatus = "disconnected" | "connecting" | "connected";

export interface WalletState {
  status: WalletConnectionStatus;
  address?: string;
}

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function isValidEvmAddress(address: string): boolean {
  return EVM_ADDRESS_REGEX.test(address.trim());
}

export function generateMockEvmAddress(): `0x${string}` {
  const bytes = Array.from(crypto.getRandomValues(new Uint8Array(20)));
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return `0x${hex}`;
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

export function getConnectableAddress(address?: string): `0x${string}` {
  if (address && isValidEvmAddress(address)) {
    return address as `0x${string}`;
  }

  return generateMockEvmAddress();
}
