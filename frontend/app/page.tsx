"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BridgeWidget from "../components/BridgeWidget";
import WalletButton from "../components/WalletButton";
import { getBtcUsdRate, getNetworks, getQuote, getTokenBalance, getTokens, initiateBridge } from "../lib/api";
import { connectMetaMask, isValidEvmAddress, type WalletState } from "../lib/wallet";
import {
  SUPPORTED_CHAINS,
  type NetworkInfo,
  type QuoteResponse,
  type SupportedChain,
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

function parseScaledAmount(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "00000000").slice(0, 8);
  const scaled = BigInt(whole) * SATS_MULTIPLIER + BigInt(fracPadded);
  return scaled.toString();
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

type FieldErrors = Partial<
  Record<"sourceChain" | "destinationChain" | "amountSats" | "recipientAddress", string>
>;

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

function getFieldErrors(
  sourceChain: SupportedChain,
  destinationChain: SupportedChain,
  amountSats: string,
  recipientAddress: string,
): FieldErrors {
  const errors: FieldErrors = {};
  if (sourceChain === destinationChain) {
    errors.destinationChain = "Must differ from source chain.";
  }
  const sats = Number(amountSats);
  if (amountSats !== "" && (!Number.isFinite(sats) || sats <= 0)) {
    errors.amountSats = "Enter a positive token amount.";
  }
  if (recipientAddress !== "" && !isValidEvmAddress(recipientAddress)) {
    errors.recipientAddress = "Enter a valid 0x\u2026 address.";
  }
  return errors;
}

function isFormComplete(
  walletAddress: string | undefined,
  sourceChain: SupportedChain,
  destinationChain: SupportedChain,
  amountSats: string,
  recipientAddress: string,
  sourceToken: string,
  destinationToken: string,
): boolean {
  if (!walletAddress) return false;
  if (sourceChain === destinationChain) return false;
  if (!sourceToken || !destinationToken) return false;
  const sats = Number(amountSats);
  if (!amountSats || !Number.isFinite(sats) || sats <= 0) return false;
  if (!isValidEvmAddress(recipientAddress)) return false;
  return true;
}

export default function HomePage() {
  const router = useRouter();

  const [wallet, setWallet] = useState<WalletState>({ status: "disconnected" });
  const [sourceChain, setSourceChain] = useState<SupportedChain>("avalanche");
  const [destinationChain, setDestinationChain] = useState<SupportedChain>("base");
  const [chainOptions, setChainOptions] = useState<SupportedChain[]>(SUPPORTED_CHAINS);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [sourceToken, setSourceToken] = useState("");
  const [destinationToken, setDestinationToken] = useState("");
  const [amountSats, setAmountSats] = useState("100000");
  const [recipientAddress, setRecipientAddress] = useState("");

  const [quote, setQuote] = useState<QuoteResponse | undefined>();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [usdRate, setUsdRate] = useState<number | undefined>();
  const [walletBalanceTokens, setWalletBalanceTokens] = useState<string | undefined>();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch BTC/USD rate once on mount; silently ignore failures
  useEffect(() => {
    getBtcUsdRate()
      .then(setUsdRate)
      .catch(() => undefined);
  }, []);

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
          return;
        }
        const address = accounts[0];
        if (!isValidEvmAddress(address)) {
          setWallet({ status: "disconnected" });
          setWalletBalanceTokens(undefined);
          setErrorMessage("Invalid address returned from MetaMask.");
          return;
        }
        setWallet({ status: "connected", address });
      } catch (err) {
        setWallet({ status: "disconnected" });
        setWalletBalanceTokens(undefined);
        setErrorMessage(err instanceof Error ? err.message : "Failed to read MetaMask accounts.");
      }
    };

    const handleAccountsChanged = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? (accounts as string[]) : [];
      if (list.length === 0) {
        setWallet({ status: "disconnected" });
        setWalletBalanceTokens(undefined);
        setQuote(undefined);
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
      setErrorMessage("Invalid address returned from MetaMask.");
    };

    const handleDisconnect = () => {
      setWallet({ status: "disconnected" });
          setWalletBalanceTokens(undefined);
      setQuote(undefined);
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

  const sourceTokenOptions = tokens.filter((token) => resolveTokenChain(token) === sourceChain);
  const destinationTokenOptions = tokens.filter(
    (token) => resolveTokenChain(token) === destinationChain,
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

  const sourceTokenInfo = sourceTokenOptions.find((token) => tokenLabel(token) === sourceToken);

  useEffect(() => {
    if (!wallet.address || !sourceTokenInfo) {
      setWalletBalanceTokens(undefined);
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
        if (!cancelled) setWalletBalanceTokens(balance);
      } catch {
        if (!cancelled) setWalletBalanceTokens(undefined);
      }
    };

    void loadBalance();

    return () => {
      cancelled = true;
    };
  }, [wallet.address, sourceTokenInfo?.address, sourceTokenInfo?.decimals, sourceTokenInfo?.chain_id]);

  const fieldErrors = getFieldErrors(sourceChain, destinationChain, amountSats, recipientAddress);
  const hasErrors = Object.keys(fieldErrors).length > 0;
  const formComplete = isFormComplete(
    wallet.address,
    sourceChain,
    destinationChain,
    amountSats,
    recipientAddress,
    sourceToken,
    destinationToken,
  );

  // Auto-fetch quote whenever the form becomes complete and valid
  useEffect(() => {
    if (!formComplete) {
      setQuote(undefined);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setErrorMessage("");
      const scaledAmount = parseScaledAmount(amountSats);
      if (!scaledAmount) {
        setLoading(false);
        setErrorMessage("Enter a valid token amount.");
        return;
      }
      getQuote({
        sourceChain,
        destinationChain,
        sourceToken,
        destinationToken,
        amountSats: scaledAmount,
        walletAddress: wallet.address!,
      })
        .then((result) => setQuote(result))
        .catch((err: unknown) => {
          setErrorMessage(err instanceof Error ? err.message : "Failed to fetch quote.");
          setQuote(undefined);
        })
        .finally(() => setLoading(false));
    }, QUOTE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    sourceChain,
    destinationChain,
    sourceToken,
    destinationToken,
    amountSats,
    recipientAddress,
    wallet.address,
    formComplete,
  ]);

  const handleConnect = useCallback(async () => {
    setWallet({ status: "connecting" });
    try {
      const address = await connectMetaMask();
      setWallet({ status: "connected", address });
      setErrorMessage("");
    } catch (err) {
      setWallet({ status: "disconnected" });
      setErrorMessage(err instanceof Error ? err.message : "Failed to connect wallet.");
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setWallet({ status: "disconnected" });
    setWalletBalanceTokens(undefined);
    setQuote(undefined);
    setErrorMessage("");
  }, []);

  const handleSwapChains = useCallback(() => {
    setSourceChain((prev) => {
      setDestinationChain(prev);
      return destinationChain;
    });
    setQuote(undefined);
  }, [destinationChain]);

  const handleSubmit = useCallback(async () => {
    if (!wallet.address) {
      setErrorMessage("Connect your wallet to continue.");
      return;
    }
    if (!formComplete || !quote) return;

    setLoading(true);
    setErrorMessage("");
    try {
      const response = await initiateBridge({
        quoteId: quote.quoteId,
        walletAddress: wallet.address,
      });
      router.push(`/bridge/${response.transferId}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Bridge initiation failed.");
      setLoading(false);
    }
  }, [wallet.address, formComplete, quote, router]);

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
              Bridge BTC
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "#5a6d9a", fontWeight: 400, lineHeight: 1.5 }}>
              Transfer wrapped BTC across Ethereum L2s — no custodians, verified on-chain.
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
          recipientAddress={recipientAddress}
          chainOptions={chainOptions}
          sourceTokenOptions={sourceTokenOptions}
          destinationTokenOptions={destinationTokenOptions}
          quote={quote}
          ctaLabel="Bridge"
          loading={loading}
          canSubmit={formComplete && !!quote}
          fieldErrors={hasErrors ? fieldErrors : undefined}
          infoMessage={!wallet.address ? "Connect your wallet to get a live quote." : undefined}
          errorMessage={wallet.address ? errorMessage || undefined : undefined}
          walletBalanceTokens={wallet.status === "connected" ? walletBalanceTokens : undefined}
          usdRate={usdRate}
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
          onRecipientAddressChange={setRecipientAddress}
          onSwapChains={handleSwapChains}
          onSubmit={handleSubmit}
        />

        {/* Trust badges */}
        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "0% bridge fee" },
            { label: "~2 min settlement" },
            { label: "On-chain proof" },
            { label: "Non-custodial" },
          ].map(({ label }) => (
            <span
              key={label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid #1a2240",
                background: "#0d1326",
                fontSize: 11,
                fontWeight: 500,
                color: "#6b7db3",
                letterSpacing: "0.01em",
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#2e4060",
                  display: "inline-block",
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              {label}
            </span>
          ))}
        </div>

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
