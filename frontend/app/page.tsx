"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createTransfer,
  getAssets,
  getChains,
  getTransferById,
  shortAddress,
  statusLabel,
  type Asset,
  type Chain,
} from "./mvp";

const defaultWallet = "0x8db9f3e6a72c290b61af2A68a6d69FBA3d53F124";

function randomWallet() {
  const chars = "abcdef0123456789";
  let value = "0x";
  for (let i = 0; i < 40; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

export default function HomePage() {
  const chains = useMemo(() => getChains(), []);
  const assets = useMemo(() => getAssets(), []);

  const [wallet, setWallet] = useState("");
  const [sourceChain, setSourceChain] = useState<Chain>("Ethereum");
  const [destinationChain, setDestinationChain] = useState<Chain>("Arbitrum");
  const [asset, setAsset] = useState<Asset>("USDC");
  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState(defaultWallet);
  const [recentTransferIds, setRecentTransferIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const ids: string[] = [];
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("bridgx-mvp-transfers");
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Array<{ id: string }>;
          parsed.slice(0, 5).forEach((item) => ids.push(item.id));
        } catch {
          // noop
        }
      }
    }
    setRecentTransferIds(ids);
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!wallet) {
      setError("Connect wallet before creating transfer.");
      return;
    }
    if (sourceChain === destinationChain) {
      setError("Source and destination chains must be different.");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be a valid number greater than zero.");
      return;
    }

    const transfer = createTransfer({
      walletAddress: wallet,
      recipientAddress: recipient,
      sourceChain,
      destinationChain,
      asset,
      amount: parsedAmount,
    });

    window.location.href = `/bridge/${transfer.id}`;
  }

  return (
    <section>
      <h1 style={{ marginTop: 0, fontSize: 30 }}>Create a Cross-Chain Transfer</h1>
      <p style={{ marginTop: 8, color: "#b7c5ff", maxWidth: 700 }}>
        This MVP flow lets users connect a wallet, create a bridge order, and track transfer progression in real-time.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, alignItems: "start", marginTop: 24 }}>
        <form
          onSubmit={onSubmit}
          style={{ border: "1px solid #29335a", borderRadius: 14, padding: 18, background: "#121937" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <strong>Transfer Details</strong>
            {wallet ? (
              <button type="button" onClick={() => setWallet("")} style={buttonGhost}>
                Disconnect {shortAddress(wallet)}
              </button>
            ) : (
              <button type="button" onClick={() => setWallet(randomWallet())} style={buttonPrimary}>
                Connect Wallet
              </button>
            )}
          </div>

          <div style={grid2}>
            <label style={labelStyle}>
              Source Chain
              <select value={sourceChain} onChange={(e) => setSourceChain(e.target.value as Chain)} style={inputStyle}>
                {chains.map((chain) => (
                  <option key={chain} value={chain}>
                    {chain}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Destination Chain
              <select
                value={destinationChain}
                onChange={(e) => setDestinationChain(e.target.value as Chain)}
                style={inputStyle}
              >
                {chains.map((chain) => (
                  <option key={chain} value={chain}>
                    {chain}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={grid2}>
            <label style={labelStyle}>
              Asset
              <select value={asset} onChange={(e) => setAsset(e.target.value as Asset)} style={inputStyle}>
                {assets.map((token) => (
                  <option key={token} value={token}>
                    {token}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Amount
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="any" style={inputStyle} />
            </label>
          </div>

          <label style={labelStyle}>
            Recipient Address
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              style={inputStyle}
              required
            />
          </label>

          {error && <p style={{ color: "#ff8ca2", marginBottom: 0 }}>{error}</p>}

          <button type="submit" style={{ ...buttonPrimary, marginTop: 16, width: "100%", justifyContent: "center" }}>
            Create Transfer
          </button>
        </form>

        <aside style={{ border: "1px solid #29335a", borderRadius: 14, padding: 18, background: "#121937" }}>
          <strong>Recent Transfers</strong>
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {recentTransferIds.length === 0 ? (
              <p style={{ color: "#9eb3ff", margin: 0 }}>No transfers yet.</p>
            ) : (
              recentTransferIds.map((id) => {
                const transfer = getTransferById(id);
                if (!transfer) return null;
                return (
                  <a key={id} href={`/bridge/${id}`} style={itemCard}>
                    <div style={{ fontWeight: 600 }}>{id}</div>
                    <div style={{ color: "#9eb3ff", fontSize: 13 }}>
                      {transfer.amount} {transfer.asset} • {statusLabel(transfer.status)}
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 } as const;
const labelStyle = { display: "grid", gap: 8, fontSize: 13, color: "#dce4ff", marginBottom: 12 } as const;
const inputStyle = {
  width: "100%",
  border: "1px solid #344377",
  borderRadius: 10,
  padding: "10px 12px",
  background: "#0f1632",
  color: "#f2f5ff",
} as const;
const buttonPrimary = {
  border: "none",
  borderRadius: 10,
  padding: "10px 12px",
  color: "#ffffff",
  background: "linear-gradient(120deg, #4568ff, #7b44ff)",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
} as const;
const buttonGhost = {
  border: "1px solid #4c5f9d",
  borderRadius: 10,
  padding: "9px 10px",
  color: "#dce4ff",
  background: "transparent",
  fontWeight: 600,
  cursor: "pointer",
} as const;
const itemCard = {
  border: "1px solid #2e3a69",
  borderRadius: 10,
  padding: 10,
  color: "#f2f5ff",
  textDecoration: "none",
  background: "#111a3a",
} as const;
