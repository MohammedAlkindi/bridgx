export const SUPPORTED_CHAINS = ["base", "arbitrum", "optimism"] as const;

export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

export type TransferStatus =
  | "CREATED"
  | "SOURCE_TX_SUBMITTED"
  | "SOURCE_CONFIRMED"
  | "ATTESTATION_PENDING"
  | "ATTESTATION_READY"
  | "DEST_TX_SUBMITTED"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED";

export type TxHash = `0x${string}`;

export interface QuoteRequest {
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  sourceToken: string;
  destinationToken: string;
  amountSats: string;
  walletAddress: string;
}

export interface QuoteResponse {
  quoteId: string;
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  sourceAmountSats: string;
  destinationAmountSats: string;
  estimatedDurationSec: number;
  routeExpiresAt: string;
}

export interface TokenInfo {
  address: string;
  symbol?: string | null;
  name?: string | null;
  decimals: number;
  chain_id: number;
  chain_name?: string | null;
}

export interface BridgeInitiateRequest {
  quoteId: string;
  walletAddress: string;
}

export interface BridgeInitiateResponse {
  transferId: string;
  status: TransferStatus;
  sourceTxHash?: TxHash;
}

export interface TransferStatusResponse {
  transferId: string;
  status: TransferStatus;
  sourceTxHash?: TxHash;
  destinationTxHash?: TxHash;
  updatedAt: string;
  errorMessage?: string;
}

export interface TransferReceiptResponse {
  transferId: string;
  status: Extract<TransferStatus, "COMPLETED" | "FAILED" | "EXPIRED">;
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  sourceAmountSats: string;
  receivedAmountSats?: string;
  sourceTxHash?: TxHash;
  destinationTxHash?: TxHash;
  completedAt?: string;
  failureReason?: string;
}

export interface TransferStatusStreamEvent {
  transferId: string;
  status: TransferStatus;
  updatedAt: string;
  sourceTxHash?: TxHash;
  destinationTxHash?: TxHash;
  errorMessage?: string;
}

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  CREATED: "Transfer initiated",
  SOURCE_TX_SUBMITTED: "Source transaction submitted",
  SOURCE_CONFIRMED: "Source transaction confirmed",
  ATTESTATION_PENDING: "Awaiting attestation",
  ATTESTATION_READY: "Attestation confirmed",
  DEST_TX_SUBMITTED: "Finalizing on destination",
  COMPLETED: "Transfer complete",
  FAILED: "Failed",
  EXPIRED: "Expired",
};
