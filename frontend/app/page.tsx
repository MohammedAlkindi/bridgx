"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BridgeWidget from "../components/BridgeWidget";
import WalletButton from "../components/WalletButton";
import { getQuote, initiateBridge } from "../lib/api";
import { generateMockEvmAddress, isValidEvmAddress, type WalletState } from "../lib/wallet";
import { SUPPORTED_CHAINS, type QuoteResponse, type SupportedChain } from "../types";

const QUOTE_DEBOUNCE_MS = 600;

type FieldErrors = Partial<
  Record<"sourceChain" | "destinationChain" | "amountSats" | "recipientAddress", string>
>;

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
): boolean {
  if (!walletAddress) return false;
  if (sourceChain === destinationChain) return false;
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
  const [amountSats, setAmountSats] = useState("100000");
  const [recipientAddress, setRecipientAddress] = useState("");

  const [quote, setQuote] = useState<QuoteResponse | undefined>();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fieldErrors = getFieldErrors(sourceChain, destinationChain, amountSats, recipientAddress);
  const hasErrors = Object.keys(fieldErrors).length > 0;
  const formComplete = isFormComplete(
    wallet.address,
    sourceChain,
    destinationChain,
    amountSats,
    recipientAddress,
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
        sourceToken: "BTC",
        destinationToken: "BTC",
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
  }, [sourceChain, destinationChain, amountSats, recipientAddress, wallet.address, formComplete]);

  const handleConnect = useCallback(() => {
    setWallet({ status: "connecting" });
    setTimeout(() => {
      setWallet({ status: "connected", address: generateMockEvmAddress() });
    }, 600);
  }, []);

  const handleDisconnect = useCallback(() => {
    setWallet({ status: "disconnected" });
    setQuote(undefined);
    setErrorMessage("");
  }, []);

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

  const displayError = !wallet.address
    ? "Connect your wallet to get a quote."
    : errorMessage;

  return (
    <section>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div
          style={{
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#f0f4ff" }}>
              Bridge BTC
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#6b7db3" }}>
              Powered by Odos &amp; Circle CCTP
            </p>
          </div>
          <WalletButton
            status={wallet.status}
            address={wallet.address}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>

        <BridgeWidget
          sourceChain={sourceChain}
          destinationChain={destinationChain}
          amountSats={amountSats}
          recipientAddress={recipientAddress}
          chainOptions={SUPPORTED_CHAINS}
          quote={quote}
          ctaLabel="Bridge BTC"
          loading={loading}
          canSubmit={formComplete && !!quote}
          fieldErrors={hasErrors ? fieldErrors : undefined}
          errorMessage={displayError}
          onSourceChainChange={(chain) => {
            setSourceChain(chain);
            setQuote(undefined);
          }}
          onDestinationChainChange={(chain) => {
            setDestinationChain(chain);
            setQuote(undefined);
          }}
          onAmountSatsChange={(v) => {
            setAmountSats(v);
            setQuote(undefined);
          }}
          onRecipientAddressChange={setRecipientAddress}
          onSubmit={handleSubmit}
        />

        <ul
          style={{
            marginTop: 28,
            display: "flex",
            justifyContent: "center",
            gap: 32,
            listStyle: "none",
            padding: 0,
            fontSize: 12,
            color: "#4a5a8a",
          }}
        >
          <li>&#10022; 0% bridge fee</li>
          <li>&#10022; ~2 min settlement</li>
          <li>&#10022; On-chain proof</li>
        </ul>
      </div>
    </section>
  );
}
