import type {
  BridgeInitiateRequest,
  BridgeInitiateResponse,
  AssembleRequest,
  AssembledTransaction,
  SwapIntentRequest,
  SwapIntentResponse,
  AttestationRequest,
  AttestationResponse,
  NetworkInfo,
  QuoteRequest,
  QuoteResponse,
  ReceiptRequest,
  ReceiptResponse,
  TokenBalanceResponse,
  TokenInfo,
  TransferReceiptResponse,
  TransferStatusResponse,
} from "../types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const FORCE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";
const MOCK_API_ENABLED = FORCE_MOCK_API || process.env.NODE_ENV !== "production";

const JSON_HEADERS = { "Content-Type": "application/json" };

type TokenPayload = {
  address: string;
  decimals: number;
  chain_id: number;
};

type OutputAmountRequest = {
  amount_in: string;
  token_in: TokenPayload;
  token_med_in: TokenPayload;
  token_med_out: TokenPayload;
  token_out: TokenPayload;
  wallet_address?: string;
  slippage_perc?: number;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed (${response.status}) ${path}`);
  }

  return (await response.json()) as T;
}

function buildMockQuote(request: QuoteRequest): QuoteResponse {
  const now = Date.now();
  return {
    quoteId: `mock-quote-${now}`,
    sourceChain: request.sourceChain,
    destinationChain: request.destinationChain,
    sourceAmountSats: request.amountSats,
    destinationAmountSats: request.amountSats,
    estimatedDurationSec: 90,
    routeExpiresAt: new Date(now + 5 * 60 * 1000).toISOString(),
  };
}

function buildMockInitiation(request: BridgeInitiateRequest): BridgeInitiateResponse {
  return {
    transferId: `mock-transfer-${request.quoteId}`,
    status: "CREATED",
  };
}

function buildMockStatus(transferId: string): TransferStatusResponse {
  return {
    transferId,
    status: "ATTESTATION_PENDING",
    updatedAt: new Date().toISOString(),
  };
}

function buildMockReceipt(transferId: string): TransferReceiptResponse {
  return {
    transferId,
    status: "COMPLETED",
    sourceChain: "base",
    destinationChain: "arbitrum",
    sourceAmountSats: "100000",
    receivedAmountSats: "100000",
    completedAt: new Date().toISOString(),
  };
}

function buildMockAssemble(_: AssembleRequest): AssembledTransaction {
  return {
    to: "0x0000000000000000000000000000000000000000",
    data: "0x",
    value: "0x0",
  };
}

export async function getQuote(request: QuoteRequest): Promise<QuoteResponse> {
  if (MOCK_API_ENABLED) {
    try {
      return await requestJson<QuoteResponse>("/quote", {
        method: "POST",
        body: JSON.stringify(request),
      });
    } catch {
      return buildMockQuote(request);
    }
  }

  return requestJson<QuoteResponse>("/quote", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function assembleTx(request: AssembleRequest): Promise<AssembledTransaction> {
  if (FORCE_MOCK_API) {
    return buildMockAssemble(request);
  }

  return requestJson<AssembledTransaction>("/assemble", {
    method: "POST",
    body: JSON.stringify({
      quote_id: request.quoteId,
      wallet_address: request.walletAddress,
    }),
  });
}

export async function registerSwapIntent(
  request: SwapIntentRequest,
): Promise<SwapIntentResponse> {
  if (MOCK_API_ENABLED) {
    try {
      return await requestJson<SwapIntentResponse>("/swap-intent", {
        method: "POST",
        body: JSON.stringify({
          source_tx_hash: request.sourceTxHash,
          destination_chain: request.destinationChain,
          recipient: request.recipient,
          token_address: request.tokenAddress,
          token_decimals: request.tokenDecimals,
        }),
      });
    } catch {
      return { status: "mock" };
    }
  }

  return requestJson<SwapIntentResponse>("/swap-intent", {
    method: "POST",
    body: JSON.stringify({
      source_tx_hash: request.sourceTxHash,
      destination_chain: request.destinationChain,
      recipient: request.recipient,
      token_address: request.tokenAddress,
      token_decimals: request.tokenDecimals,
    }),
  });
}

export async function requestAttestation(
  request: AttestationRequest,
): Promise<AttestationResponse> {
  return requestJson<AttestationResponse>("/attestation", {
    method: "POST",
    body: JSON.stringify({
      source_tx_hash: request.sourceTxHash,
      source_chain: request.sourceChain,
      destination_chain: request.destinationChain,
      poll_attempts: request.pollAttempts,
      poll_interval_s: request.pollIntervalS,
    }),
  });
}

export async function getReceipt(request: ReceiptRequest): Promise<ReceiptResponse> {
  return requestJson<ReceiptResponse>("/receipt", {
    method: "POST",
    body: JSON.stringify({
      tx_hash: request.txHash,
      chain: request.chain,
    }),
  });
}

export async function initiateBridge(
  request: BridgeInitiateRequest,
): Promise<BridgeInitiateResponse> {
  if (MOCK_API_ENABLED) {
    try {
      return await requestJson<BridgeInitiateResponse>("/bridge/initiate", {
        method: "POST",
        body: JSON.stringify(request),
      });
    } catch {
      return buildMockInitiation(request);
    }
  }

  return requestJson<BridgeInitiateResponse>("/bridge/initiate", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getBridgeStatus(
  transferId: string,
): Promise<TransferStatusResponse> {
  if (MOCK_API_ENABLED) {
    try {
      return await requestJson<TransferStatusResponse>(`/bridge/${transferId}/status`);
    } catch {
      return buildMockStatus(transferId);
    }
  }

  return requestJson<TransferStatusResponse>(`/bridge/${transferId}/status`);
}

export async function getBridgeReceipt(
  transferId: string,
): Promise<TransferReceiptResponse> {
  if (MOCK_API_ENABLED) {
    try {
      return await requestJson<TransferReceiptResponse>(`/bridge/${transferId}/receipt`);
    } catch {
      return buildMockReceipt(transferId);
    }
  }

  return requestJson<TransferReceiptResponse>(`/bridge/${transferId}/receipt`);
}

export async function getBtcUsdRate(): Promise<number> {
  if (MOCK_API_ENABLED) {
    try {
      const data = await requestJson<{ usd: number }>("/btc-price");
      return data.usd;
    } catch {
      return 85000;
    }
  }
  const data = await requestJson<{ usd: number }>("/btc-price");
  return data.usd;
}

export async function getTokens(): Promise<TokenInfo[]> {
  if (MOCK_API_ENABLED) {
    try {
      return await requestJson<TokenInfo[]>("/tokens");
    } catch {
      return [];
    }
  }

  return requestJson<TokenInfo[]>("/tokens");
}

export async function getNetworks(): Promise<NetworkInfo[]> {
  if (MOCK_API_ENABLED) {
    try {
      return await requestJson<NetworkInfo[]>("/networks");
    } catch {
      return [];
    }
  }

  return requestJson<NetworkInfo[]>("/networks");
}

export async function getTokenBalance(
  tokenAddress: string,
  walletAddress: string,
  chainId: number,
): Promise<TokenBalanceResponse> {
  return requestJson<TokenBalanceResponse>(
    `/token-balance?token_address=${encodeURIComponent(tokenAddress)}&wallet_address=${encodeURIComponent(
      walletAddress,
    )}&chain_id=${chainId}`,
  );
}

export async function getTokenPrice(tokenAddress: string, chainId: number): Promise<number> {
  if (MOCK_API_ENABLED) {
    try {
      return await requestJson<number>("/token-price", {
        method: "POST",
        body: JSON.stringify({ token_address: tokenAddress, chain_id: chainId }),
      });
    } catch {
      return Number.NaN;
    }
  }
  return requestJson<number>("/token-price", {
    method: "POST",
    body: JSON.stringify({ token_address: tokenAddress, chain_id: chainId }),
  });
}

export async function getOutputAmount(request: OutputAmountRequest): Promise<number> {
  if (MOCK_API_ENABLED) {
    try {
      return await requestJson<number>("/output-amount", {
        method: "POST",
        body: JSON.stringify(request),
      });
    } catch {
      return Number(request.amount_in);
    }
  }
  return requestJson<number>("/output-amount", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
