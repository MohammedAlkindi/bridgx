"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import BridgeWidget from "../components/BridgeWidget";
import WalletButton from "../components/WalletButton";
import {
  assembleTx,
  getNetworks,
  getQuote,
  getReceipt,
  getTokenBalance,
  getTokenPrice,
  getTokens,
  registerSwapIntent,
  requestAttestation,
} from "../lib/api";
import {
  connectMetaMask,
  disconnectMetaMask,
  isValidEvmAddress,
  requestWalletPermissions,
  type WalletState,
} from "../lib/wallet";
import {
  SUPPORTED_CHAINS,
  type AssembledTransaction,
  type NetworkInfo,
  type QuoteResponse,
  type SupportedChain,
  type TxHash,
  type TokenInfo,
} from "../types";

const QUOTE_DEBOUNCE_MS = 600;
const SATS_MULTIPLIER = 100000000n;

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

function getEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined" || !("ethereum" in window)) return null;
  return window.ethereum as EthereumProvider;
}

function buildBalanceOfCall(address: string): string {
  const clean = address.toLowerCase().replace(/^0x/, "");
  return `0x70a08231${clean.padStart(64, "0")}`;
}

function buildAllowanceCall(owner: string, spender: string): string {
  const ownerClean = owner.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const spenderClean = spender.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  return `0xdd62ed3e${ownerClean}${spenderClean}`;
}

function buildApproveCall(spender: string, amount: bigint): string {
  const spenderClean = spender.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const amountHex = amount.toString(16).padStart(64, "0");
  return `0x095ea7b3${spenderClean}${amountHex}`;
}

function parseScaledAmount(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "00000000").slice(0, 8);
  const scaled = BigInt(whole) * SATS_MULTIPLIER + BigInt(fracPadded);
  return scaled.toString();
}

function parseAmountToBaseUnits(amount: string, decimals: number): bigint | null {
  const trimmed = amount.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const padded = decimals > 0 ? (frac + "0".repeat(decimals)).slice(0, decimals) : "";
  const base = BigInt(whole) * 10n ** BigInt(decimals) + (padded ? BigInt(padded) : 0n);
  return base;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_UINT256 = (1n << 256n) - 1n;

async function waitForReceipt(
  ethereum: EthereumProvider,
  txHash: string,
  attempts = 30,
  intervalMs = 3000,
): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    const receipt = (await ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as { status?: string } | null;
    if (receipt) {
      return receipt.status === undefined || receipt.status === "0x1";
    }
    await sleep(intervalMs);
  }
  return false;
}

function toHex(value: string | number | bigint): string {
  if (typeof value === "string") {
    if (value.startsWith("0x")) return value;
    return `0x${BigInt(value).toString(16)}`;
  }
  return `0x${BigInt(value).toString(16)}`;
}

function normalizeTransaction(tx: AssembledTransaction, from: string) {
  const normalized: Record<string, string> = {
    from,
    to: tx.to,
    data: tx.data,
  };
  if (tx.value !== undefined) normalized.value = toHex(tx.value);
  if (tx.gas !== undefined) normalized.gas = toHex(tx.gas);
  if (tx.gasPrice !== undefined) normalized.gasPrice = toHex(tx.gasPrice);
  if (tx.maxFeePerGas !== undefined) normalized.maxFeePerGas = toHex(tx.maxFeePerGas);
  if (tx.maxPriorityFeePerGas !== undefined) {
    normalized.maxPriorityFeePerGas = toHex(tx.maxPriorityFeePerGas);
  }
  if (tx.chainId !== undefined) normalized.chainId = toHex(tx.chainId);
  return normalized;
}


function formatTokenBalance(raw: bigint, decimals: number, maxDecimals = 6): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  if (fraction === 0n) return whole.toString();
  let fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  if (fractionStr.length > maxDecimals) {
    fractionStr = fractionStr.slice(0, maxDecimals);
  }
  return `${whole}.${fractionStr}`;
}

type FieldErrors = Partial<Record<"sourceChain" | "destinationChain" | "amountSats", string>>;

const CHAIN_ID_TO_NAME: Record<number, SupportedChain> = {
  43114: "avalanche",
  8453: "base",
  42161: "arbitrum",
};

function resolveTokenChain(token: TokenInfo): SupportedChain | null {
  const chainName = token.chain_name?.toLowerCase();
  if (chainName === "avalanche" || chainName === "base" || chainName === "arbitrum") {
    return chainName;
  }
  return CHAIN_ID_TO_NAME[token.chain_id] ?? null;
}

function tokenLabel(token: TokenInfo): string {
  return token.symbol ?? token.name ?? token.address;
}

const BTC_TOKEN_SYMBOLS = new Set(["BTCB", "WBTC", "WBTC.E", "CBBTC", "TBTC"]);
const WETH_TOKEN_SYMBOLS = new Set(["WETH"]);
const EXPLORER_TX_URLS: Record<SupportedChain, string> = {
  avalanche: "https://snowtrace.io/tx/",
  base: "https://basescan.org/tx/",
  arbitrum: "https://arbiscan.io/tx/",
};
const SOURCE_EXECUTOR_ADDRESSES: Partial<Record<SupportedChain, string>> = {
  avalanche: "0xeC20cbb6C99e4b8b78cbd81b27Ce0B7aaD222A2d",
};

function tokenFamily(token?: TokenInfo | null): "btc" | "weth" | null {
  if (!token) return null;
  const symbol = token.symbol?.toUpperCase();
  if (symbol) {
    if (BTC_TOKEN_SYMBOLS.has(symbol)) return "btc";
    if (WETH_TOKEN_SYMBOLS.has(symbol)) return "weth";
  }
  const name = token.name?.toUpperCase();
  if (name) {
    if (name.includes("BTC")) return "btc";
    if (name.includes("WETH")) return "weth";
  }
  return null;
}


function getFieldErrors(
  sourceChain: SupportedChain,
  destinationChain: SupportedChain,
): FieldErrors {
  const errors: FieldErrors = {};
  if (sourceChain === destinationChain) {
    errors.destinationChain = "Must differ from source chain.";
  }
  return errors;
}

function isFormComplete(
  sourceChain: SupportedChain,
  destinationChain: SupportedChain,
  amountSats: string,
  sourceToken: string,
  destinationToken: string,
): boolean {
  if (sourceChain === destinationChain) return false;
  if (!sourceToken || !destinationToken) return false;
  const sats = Number(amountSats);
  if (!amountSats || !Number.isFinite(sats) || sats <= 0) return false;
  return true;
}

export default function HomePage() {

  const [wallet, setWallet] = useState<WalletState>({ status: "disconnected" });
  const [sourceChain, setSourceChain] = useState<SupportedChain>("avalanche");
  const [destinationChain, setDestinationChain] = useState<SupportedChain>("base");
  const [chainOptions, setChainOptions] = useState<SupportedChain[]>(SUPPORTED_CHAINS);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [sourceToken, setSourceToken] = useState("");
  const [destinationToken, setDestinationToken] = useState("");
  const [amountSats, setAmountSats] = useState("0.01");

  const [quote, setQuote] = useState<QuoteResponse | undefined>();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [tokenUsdPrice, setTokenUsdPrice] = useState<number | undefined>();
  const [destinationTokenUsdPrice, setDestinationTokenUsdPrice] = useState<number | undefined>();
  const [walletBalanceTokens, setWalletBalanceTokens] = useState<string | undefined>();
  const [walletBalanceRaw, setWalletBalanceRaw] = useState<bigint | undefined>();
  const [shouldPromptConnect, setShouldPromptConnect] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sourceTxHash, setSourceTxHash] = useState<TxHash | undefined>();
  const [destinationTxHash, setDestinationTxHash] = useState<TxHash | undefined>();
  const [releaseTxHash, setReleaseTxHash] = useState<TxHash | undefined>();
  const [swapTxHash, setSwapTxHash] = useState<TxHash | undefined>();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walletAddressRef = useRef<string | undefined>();

  useEffect(() => {
    walletAddressRef.current = wallet.address;
  }, [wallet.address]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const hoverColor = wallet.address ? "#047857" : "#cc7810";
    document.documentElement.style.setProperty("--nav-link-hover-color", hoverColor);
    const brandColor = wallet.address ? "#34d399" : "#F7931A";
    document.documentElement.style.setProperty("--brand-accent-color", brandColor);
  }, [wallet.address]);

  useEffect(() => {
    getNetworks()
      .then((networks) => {
        const names = networks
          .map((network: NetworkInfo) => network.name)
          .filter((name): name is SupportedChain => SUPPORTED_CHAINS.includes(name));
        setChainOptions(names.length ? names : SUPPORTED_CHAINS);
      })
      .catch(() => setChainOptions(SUPPORTED_CHAINS));
  }, []);

  useEffect(() => {
    if (!chainOptions.length) return;
    if (!chainOptions.includes(sourceChain)) {
      setSourceChain(chainOptions[0]);
    }
    if (!chainOptions.includes(destinationChain) || destinationChain === sourceChain) {
      const fallback = chainOptions.find((chain) => chain !== sourceChain) ?? chainOptions[0];
      setDestinationChain(fallback);
    }
  }, [chainOptions, destinationChain, sourceChain]);

  useEffect(() => {
    const ethereum = getEthereumProvider();
    if (!ethereum) return;

    const syncAccounts = async () => {
      try {
        const accounts = (await ethereum.request({
          method: "eth_accounts",
        })) as string[];
        if (!accounts || accounts.length === 0) {
          setWallet({ status: "disconnected" });
          setWalletBalanceTokens(undefined);
          setWalletBalanceRaw(undefined);
          setShouldPromptConnect(true);
          return;
        }
        const address = accounts[0];
        if (!isValidEvmAddress(address)) {
          setWallet({ status: "disconnected" });
          setWalletBalanceTokens(undefined);
          setWalletBalanceRaw(undefined);
          setShouldPromptConnect(true);
          setErrorMessage("Invalid address returned from MetaMask.");
          return;
        }
        setWallet({ status: "connected", address });
      } catch (err) {
        setWallet({ status: "disconnected" });
        setWalletBalanceTokens(undefined);
        setWalletBalanceRaw(undefined);
        setShouldPromptConnect(true);
        setErrorMessage(err instanceof Error ? err.message : "Failed to read MetaMask accounts.");
      }
    };

    const handleAccountsChanged = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? (accounts as string[]) : [];
      if (list.length === 0) {
        setWallet({ status: "disconnected" });
        setWalletBalanceTokens(undefined);
        setWalletBalanceRaw(undefined);
        setShouldPromptConnect(true);
        return;
      }
      const address = list[0];
      if (isValidEvmAddress(address)) {
        setWallet({ status: "connected", address });
        setQuote(undefined);
        return;
      }
      setWallet({ status: "disconnected" });
      setWalletBalanceTokens(undefined);
      setWalletBalanceRaw(undefined);
      setShouldPromptConnect(true);
      setErrorMessage("Invalid address returned from MetaMask.");
    };

    const handleDisconnect = () => {
      setWallet({ status: "disconnected" });
      setWalletBalanceTokens(undefined);
      setWalletBalanceRaw(undefined);
      setShouldPromptConnect(true);
    };

    void syncAccounts();

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    ethereum.on?.("disconnect", handleDisconnect);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("disconnect", handleDisconnect);
    };
  }, []);

  useEffect(() => {
    getTokens()
      .then((data) => setTokens(data))
      .catch(() => setTokens([]));
  }, []);

  const sourceChainTokens = tokens.filter((token) => resolveTokenChain(token) === sourceChain);
  const destinationChainTokens = tokens.filter(
    (token) => resolveTokenChain(token) === destinationChain,
  );
  const sourceTokenInfo = sourceChainTokens.find((token) => tokenLabel(token) === sourceToken);
  const activeFamily = tokenFamily(sourceTokenInfo);
  const sourceTokenOptions = sourceChainTokens;
  const destinationTokenOptions = activeFamily
    ? destinationChainTokens.filter((token) => tokenFamily(token) === activeFamily)
    : destinationChainTokens;
  const destinationTokenInfo = destinationTokenOptions.find(
    (token) => tokenLabel(token) === destinationToken,
  );

  useEffect(() => {
    if (!sourceTokenOptions.length) {
      setSourceToken("");
      return;
    }
    if (!sourceTokenOptions.some((token) => tokenLabel(token) === sourceToken)) {
      setSourceToken(tokenLabel(sourceTokenOptions[0]));
    }
  }, [sourceChain, sourceTokenOptions, sourceToken]);

  useEffect(() => {
    if (!destinationTokenOptions.length) {
      setDestinationToken("");
      return;
    }
    if (!destinationTokenOptions.some((token) => tokenLabel(token) === destinationToken)) {
      setDestinationToken(tokenLabel(destinationTokenOptions[0]));
    }
  }, [destinationChain, destinationTokenOptions, destinationToken]);


  useEffect(() => {
    if (!sourceTokenInfo) {
      setTokenUsdPrice(undefined);
      return;
    }
    getTokenPrice(sourceTokenInfo.address, sourceTokenInfo.chain_id)
      .then((price) => {
        setTokenUsdPrice(Number.isFinite(price) && price > 0 ? price : undefined);
      })
      .catch(() => setTokenUsdPrice(undefined));
  }, [sourceTokenInfo?.address, sourceTokenInfo?.chain_id]);

  useEffect(() => {
    if (!destinationTokenInfo) {
      setDestinationTokenUsdPrice(undefined);
      return;
    }
    getTokenPrice(destinationTokenInfo.address, destinationTokenInfo.chain_id)
      .then((price) => {
        setDestinationTokenUsdPrice(Number.isFinite(price) && price > 0 ? price : undefined);
      })
      .catch(() => setDestinationTokenUsdPrice(undefined));
  }, [destinationTokenInfo?.address, destinationTokenInfo?.chain_id]);

  useEffect(() => {
    if (!wallet.address || !sourceTokenInfo) {
      setWalletBalanceTokens(undefined);
      setWalletBalanceRaw(undefined);
      return;
    }

    let cancelled = false;

    const loadBalance = async () => {
      try {
        const response = await getTokenBalance(
          sourceTokenInfo.address,
          wallet.address,
          sourceTokenInfo.chain_id,
        );
        const raw = BigInt(response.balance);
        const balance = formatTokenBalance(raw, sourceTokenInfo.decimals);
        if (!cancelled) {
          setWalletBalanceTokens(balance);
          setWalletBalanceRaw(raw);
        }
      } catch {
        if (!cancelled) {
          setWalletBalanceTokens(undefined);
          setWalletBalanceRaw(undefined);
        }
      }
    };

    void loadBalance();

    return () => {
      cancelled = true;
    };
  }, [wallet.address, sourceTokenInfo?.address, sourceTokenInfo?.decimals, sourceTokenInfo?.chain_id]);

  const fieldErrors = getFieldErrors(sourceChain, destinationChain);
  const hasErrors = Object.keys(fieldErrors).length > 0;
  const quoteReady = isFormComplete(
    sourceChain,
    destinationChain,
    amountSats,
    sourceToken,
    destinationToken,
  );
  const isWalletConnected = !!wallet.address;
  const amountBaseUnits =
    isWalletConnected && sourceTokenInfo ? parseAmountToBaseUnits(amountSats, sourceTokenInfo.decimals) : null;
  const insufficientFunds =
    isWalletConnected &&
    amountBaseUnits !== null &&
    walletBalanceRaw !== undefined &&
    amountBaseUnits > walletBalanceRaw;
  const canSubmit = isWalletConnected
    ? quoteReady && !!quote && !insufficientFunds && !isSubmitting
    : true;
  const ctaLabel = !isWalletConnected
    ? "Connect wallet"
    : insufficientFunds
      ? "Insufficient funds"
      : "Bridge";
  const ctaVariant = isWalletConnected ? "green" : "orange";

  const fetchQuote = useCallback(async () => {
    if (!quoteReady) {
      setLoading(false);
      setQuote(undefined);
      return;
    }

    const scaledAmount = parseScaledAmount(amountSats);
    if (!scaledAmount) {
      setQuote(undefined);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    const walletAddress = walletAddressRef.current ?? "0x0000000000000000000000000000000000000000";
    try {
      const result = await getQuote({
        sourceChain,
        destinationChain,
        sourceToken,
        destinationToken,
        amountSats: scaledAmount,
        walletAddress,
      });
      setQuote(result);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to fetch quote.");
      setQuote(undefined);
    } finally {
      setLoading(false);
    }
  }, [
    amountSats,
    destinationChain,
    destinationToken,
    quoteReady,
    sourceChain,
    sourceToken,
  ]);

  // Auto-fetch quote whenever the form becomes complete and valid
  useEffect(() => {
    if (!quoteReady) {
      setLoading(false);
      setQuote(undefined);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchQuote();
    }, QUOTE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchQuote, quoteReady]);

  const handleRefreshQuote = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void fetchQuote();
  }, [fetchQuote]);

  const handleConnect = useCallback(async () => {
    setWallet({ status: "connecting" });
    try {
      if (shouldPromptConnect) {
        await requestWalletPermissions();
      }
      const address = await connectMetaMask();
      setWallet({ status: "connected", address });
      setShouldPromptConnect(false);
      setErrorMessage("");
    } catch (err) {
      setWallet({ status: "disconnected" });
      setErrorMessage(err instanceof Error ? err.message : "Failed to connect wallet.");
    }
  }, [shouldPromptConnect]);

  const handleDisconnect = useCallback(async () => {
    await disconnectMetaMask();
    setWallet({ status: "disconnected" });
    setWalletBalanceTokens(undefined);
    setWalletBalanceRaw(undefined);
    setShouldPromptConnect(true);
    setErrorMessage("");
  }, []);

  const handleSwapChains = useCallback(() => {
    setSourceChain((prev) => {
      setDestinationChain(prev);
      return destinationChain;
    });
    setSourceToken((prev) => {
      setDestinationToken(prev);
      return destinationToken;
    });
    setQuote(undefined);
  }, [destinationChain, destinationToken]);

  const handleSubmit = useCallback(async () => {
    if (!wallet.address) return;
    if (!quoteReady || !quote || insufficientFunds || isSubmitting) return;

    const ethereum = getEthereumProvider();
    if (!ethereum) {
      setErrorMessage("MetaMask is not available.");
      return;
    }

    const sourceExecutor = SOURCE_EXECUTOR_ADDRESSES[sourceChain];
    if (!sourceExecutor) {
      setErrorMessage("SourceExecutor is not configured for this network.");
      return;
    }
    if (!sourceTokenInfo || amountBaseUnits === null) {
      setErrorMessage("Token info is not available.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSourceTxHash(undefined);
    setDestinationTxHash(undefined);
    setReleaseTxHash(undefined);
    setSwapTxHash(undefined);
    setBridgeStatus("Preparing transaction...");
    try {
      const allowanceHex = (await ethereum.request({
        method: "eth_call",
        params: [
          {
            to: sourceTokenInfo.address,
            data: buildAllowanceCall(wallet.address, sourceExecutor),
          },
          "latest",
        ],
      })) as string;
      const allowance = BigInt(allowanceHex);
      if (allowance < amountBaseUnits) {
        setBridgeStatus("Approving token...");
        const approveTxHash = (await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: wallet.address,
              to: sourceTokenInfo.address,
              data: buildApproveCall(sourceExecutor, MAX_UINT256),
            },
          ],
        })) as string;
        const approveOk = await waitForReceipt(ethereum, approveTxHash);
        if (!approveOk) {
          setBridgeStatus("Approve failed.");
          return;
        }
      }

      const assembled = await assembleTx({
        quoteId: quote.quoteId,
        walletAddress: wallet.address,
      });
      const txParams = normalizeTransaction(assembled, wallet.address);
      const txHash = (await ethereum.request({
        method: "eth_sendTransaction",
        params: [txParams],
      })) as string;
      setSourceTxHash(txHash as TxHash);
      setBridgeStatus(`Source tx submitted: ${txHash}`);

      if (!destinationTokenInfo) {
        setBridgeStatus("Destination token is not available.");
        return;
      }
      await registerSwapIntent({
        sourceTxHash: txHash as TxHash,
        destinationChain,
        recipient: wallet.address,
        tokenAddress: destinationTokenInfo.address,
        tokenDecimals: destinationTokenInfo.decimals,
      });

      let attestation;
      let isSettled = false;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        attestation = await requestAttestation({
          sourceTxHash: txHash as TxHash,
          sourceChain,
          destinationChain,
          pollAttempts: 1,
          pollIntervalS: 5,
        });
        isSettled =
          (attestation.status === "complete" && !!attestation.destinationTxHash) ||
          attestation.swapStatus === "confirmed" ||
          attestation.releaseStatus === "confirmed" ||
          !!attestation.swapTxHash;
        if (isSettled) {
          break;
        }
        const attnStatus = attestation.attestationStatus ? ` (${attestation.attestationStatus})` : "";
        const attnSource = attestation.attestationSource ? ` via ${attestation.attestationSource}` : "";
        setBridgeStatus(`Waiting for attestation${attnSource}${attnStatus}...`);
        await sleep(5000);
      }

      if (!attestation || !isSettled) {
        setBridgeStatus("Attestation pending. Check again shortly.");
        return;
      }

      const destinationTxHash = attestation.destinationTxHash as TxHash | undefined;
      if (destinationTxHash) {
        setDestinationTxHash(destinationTxHash);
      }
      if (attestation.releaseTxHash) {
        setReleaseTxHash(attestation.releaseTxHash as TxHash);
      }
      if (attestation.swapTxHash) {
        setSwapTxHash(attestation.swapTxHash as TxHash);
      }
      if (destinationTxHash) {
        setBridgeStatus(`Destination tx submitted: ${destinationTxHash}`);
      } else if (attestation.swapTxHash) {
        setBridgeStatus(`Swap tx submitted: ${attestation.swapTxHash}`);
      } else if (attestation.releaseTxHash) {
        setBridgeStatus(`Payout tx submitted: ${attestation.releaseTxHash}`);
      }

      if (destinationTxHash) {
        for (let attempt = 0; attempt < 30; attempt += 1) {
          const receipt = await getReceipt({
            txHash: destinationTxHash,
            chain: destinationChain,
          });
          if (receipt.status === "pending") {
            await sleep(5000);
            continue;
          }
          if (receipt.status === "confirmed") {
            setBridgeStatus(`Transfer complete. Destination tx: ${destinationTxHash}`);
          } else {
            setBridgeStatus("Transfer failed.");
          }
          return;
        }

        setBridgeStatus(`Destination tx pending: ${destinationTxHash}`);
      } else if (attestation.swapTxHash) {
        setBridgeStatus(`Transfer complete. Swap tx: ${attestation.swapTxHash}`);
      } else if (attestation.releaseTxHash) {
        setBridgeStatus(`Transfer complete. Payout tx: ${attestation.releaseTxHash}`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Bridge initiation failed.");
      setBridgeStatus(undefined);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    amountBaseUnits,
    destinationChain,
    destinationTokenInfo,
    insufficientFunds,
    isSubmitting,
    quote,
    quoteReady,
    sourceChain,
    sourceTokenInfo,
    wallet.address,
  ]);

  return (
    <section>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Page header row */}
        <div
          style={{
            marginBottom: 28,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 700,
                color: "#f0f4ff",
                letterSpacing: "-0.5px",
                lineHeight: 1.2,
              }}
            >
              Bridge Smarter. Receive More.
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "#5a6d9a", fontWeight: 400, lineHeight: 1.5 }}>
              We optimize the route for better execution
            </p>
          </div>
          <WalletButton
            status={wallet.status}
            address={wallet.address}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>

        {/* Bridge widget */}
        <BridgeWidget
          sourceChain={sourceChain}
          destinationChain={destinationChain}
          sourceToken={sourceToken}
          destinationToken={destinationToken}
          amountSats={amountSats}
          chainOptions={chainOptions}
          sourceTokenOptions={sourceTokenOptions}
          destinationTokenOptions={destinationTokenOptions}
          quote={quote}
          ctaLabel={ctaLabel}
          ctaVariant={ctaVariant}
          loading={loading}
          canSubmit={canSubmit}
          fieldErrors={hasErrors ? fieldErrors : undefined}
          infoMessage={bridgeStatus}
          errorMessage={wallet.address ? errorMessage || undefined : undefined}
          walletBalanceTokens={wallet.status === "connected" ? walletBalanceTokens : undefined}
          tokenUsdPrice={tokenUsdPrice}
          destinationTokenUsdPrice={destinationTokenUsdPrice}
          onRefreshQuote={handleRefreshQuote}
          canRefresh={quoteReady}
          isWalletConnected={!!wallet.address}
          onSourceChainChange={(chain) => {
            setSourceChain(chain);
            setQuote(undefined);
          }}
          onDestinationChainChange={(chain) => {
            setDestinationChain(chain);
            setQuote(undefined);
          }}
          onSourceTokenChange={(token) => {
            setSourceToken(token);
            setQuote(undefined);
          }}
          onDestinationTokenChange={(token) => {
            setDestinationToken(token);
            setQuote(undefined);
          }}
          onAmountSatsChange={(v) => {
            setAmountSats(v);
            setQuote(undefined);
          }}
          onSwapChains={handleSwapChains}
          onSubmit={wallet.address ? handleSubmit : handleConnect}
        />

        {(sourceTxHash || destinationTxHash || releaseTxHash || swapTxHash) && (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              textAlign: "center",
              fontSize: 12,
              color: "#5a6d9a",
            }}
          >
            {sourceTxHash && (
              <div>
                Source tx:{" "}
                <a
                  href={`${EXPLORER_TX_URLS[sourceChain]}${sourceTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#4a6080" }}
                >
                  {sourceTxHash}
                </a>
              </div>
            )}
            {destinationTxHash && (
              <div>
                Destination tx:{" "}
                <a
                  href={`${EXPLORER_TX_URLS[destinationChain]}${destinationTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#4a6080" }}
                >
                  {destinationTxHash}
                </a>
              </div>
            )}
            {swapTxHash && (
              <div>
                Swap tx:{" "}
                <a
                  href={`${EXPLORER_TX_URLS[destinationChain]}${swapTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#4a6080" }}
                >
                  {swapTxHash}
                </a>
              </div>
            )}
            {releaseTxHash && (
              <div>
                Payout tx:{" "}
                <a
                  href={`${EXPLORER_TX_URLS[destinationChain]}${releaseTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#4a6080" }}
                >
                  {releaseTxHash}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Protocol attribution */}
        <p
          style={{
            marginTop: 14,
            textAlign: "center",
            fontSize: 11,
            color: "#3d5070",
            lineHeight: 1.5,
          }}
        >
          Routing via{" "}
          <span style={{ color: "#4a6080" }}>Odos</span>
          {" · "}
          Cross-chain settlement via{" "}
          <span style={{ color: "#4a6080" }}>Circle CCTP</span>
        </p>
      </div>
    </section>
  );
}
