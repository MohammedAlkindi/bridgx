"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BridgeWidget from "../components/BridgeWidget";
import WalletButton from "../components/WalletButton";
import { getBtcUsdRate, getQuote, getTokens, initiateBridge } from "../lib/api";
import { connectMetaMask, isValidEvmAddress, type WalletState } from "../lib/wallet";
import { SUPPORTED_CHAINS, type QuoteResponse, type SupportedChain, type TokenInfo } from "../types";

const QUOTE_DEBOUNCE_MS = 600;
const MOCK_WALLET_BALANCE_SATS = 500_000; // 0.005 BTC — shown when wallet is connected

type FieldErrors = Partial<
  Record<"sourceChain" | "destinationChain" | "amountSats" | "recipientAddress", string>
>;

const CHAIN_ID_TO_NAME: Record<number, SupportedChain> = {
  8453: "base",
  42161: "arbitrum",
  10: "optimism",
};

function resolveTokenChain(token: TokenInfo): SupportedChain | null {
  const chainName = token.chain_name?.toLowerCase();
  if (chainName === "base" || chainName === "arbitrum" || chainName === "optimism") {
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
    errors.amountSats = "Enter a positive satoshi amount.";
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
  const [sourceChain, setSourceChain] = useState<SupportedChain>("base");
  const [destinationChain, setDestinationChain] = useState<SupportedChain>("arbitrum");
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [sourceToken, setSourceToken] = useState("");
  const [destinationToken, setDestinationToken] = useState("");
  const [amountSats, setAmountSats] = useState("100000");
  const [recipientAddress, setRecipientAddress] = useState("");

  const [quote, setQuote] = useState<QuoteResponse | undefined>();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [usdRate, setUsdRate] = useState<number | undefined>();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch BTC/USD rate once on mount; silently ignore failures
  useEffect(() => {
    getBtcUsdRate()
      .then(setUsdRate)
      .catch(() => undefined);
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
      getQuote({
        sourceChain,
        destinationChain,
        sourceToken,
        destinationToken,
        amountSats,
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
    } catch (err) {
      setWallet({ status: "disconnected" });
      setErrorMessage(err instanceof Error ? err.message : "Failed to connect wallet.");
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setWallet({ status: "disconnected" });
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
          chainOptions={SUPPORTED_CHAINS}
          sourceTokenOptions={sourceTokenOptions}
          destinationTokenOptions={destinationTokenOptions}
          quote={quote}
          ctaLabel="Bridge"
          loading={loading}
          canSubmit={formComplete && !!quote}
          fieldErrors={hasErrors ? fieldErrors : undefined}
          infoMessage={!wallet.address ? "Connect your wallet to get a live quote." : undefined}
          errorMessage={wallet.address ? errorMessage || undefined : undefined}
          walletBalanceSats={wallet.status === "connected" ? MOCK_WALLET_BALANCE_SATS : undefined}
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
