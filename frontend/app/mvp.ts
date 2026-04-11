export type Chain = "Ethereum" | "Arbitrum" | "Base" | "Polygon";
export type Asset = "USDC" | "USDT" | "ETH";

export type TransferStatus =
  | "created"
  | "source-confirming"
  | "relaying"
  | "destination-confirming"
  | "completed"
  | "failed";

export interface Transfer {
  id: string;
  walletAddress: string;
  recipientAddress: string;
  sourceChain: Chain;
  destinationChain: Chain;
  asset: Asset;
  amount: number;
  createdAt: string;
  updatedAt: string;
  status: TransferStatus;
  estimatedMinutes: number;
}

const STORAGE_KEY = "bridgx-mvp-transfers";

const CHAINS: Chain[] = ["Ethereum", "Arbitrum", "Base", "Polygon"];
const ASSETS: Asset[] = ["USDC", "USDT", "ETH"];

const STATUS_FLOW: TransferStatus[] = [
  "created",
  "source-confirming",
  "relaying",
  "destination-confirming",
  "completed",
];

export function getChains() {
  return CHAINS;
}

export function getAssets() {
  return ASSETS;
}

export function shortAddress(value: string) {
  if (!value || value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function readTransfers(): Transfer[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Transfer[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTransfers(transfers: Transfer[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transfers));
}

export function createTransfer(input: Omit<Transfer, "id" | "createdAt" | "updatedAt" | "status" | "estimatedMinutes">) {
  const now = new Date().toISOString();
  const transfer: Transfer = {
    ...input,
    id: `trx_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`,
    createdAt: now,
    updatedAt: now,
    status: "created",
    estimatedMinutes: 4 + Math.floor(Math.random() * 6),
  };

  const all = [transfer, ...readTransfers()];
  writeTransfers(all);
  return transfer;
}

export function getTransferById(id: string) {
  return readTransfers().find((item) => item.id === id) ?? null;
}

export function advanceTransfer(id: string): Transfer | null {
  const all = readTransfers();
  const idx = all.findIndex((item) => item.id === id);
  if (idx === -1) return null;

  const current = all[idx];
  if (current.status === "completed" || current.status === "failed") return current;

  const flowIndex = STATUS_FLOW.indexOf(current.status);
  const nextStatus = STATUS_FLOW[flowIndex + 1] ?? "completed";

  const updated: Transfer = {
    ...current,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };

  all[idx] = updated;
  writeTransfers(all);
  return updated;
}

export function statusLabel(status: TransferStatus) {
  switch (status) {
    case "created":
      return "Transfer Created";
    case "source-confirming":
      return "Confirming on Source Chain";
    case "relaying":
      return "Relaying Through Bridge";
    case "destination-confirming":
      return "Finalizing on Destination Chain";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export const STATUS_STEPS: TransferStatus[] = [
  "created",
  "source-confirming",
  "relaying",
  "destination-confirming",
  "completed",
];
