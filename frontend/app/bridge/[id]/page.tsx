"use client";

import { useEffect, useState } from "react";
import TransferStatusComponent from "../../../components/TransferStatus";
import { getBridgeReceipt, getBridgeStatus } from "../../../lib/api";
import type { SupportedChain, TransferReceiptResponse, TransferStatusResponse } from "../../../types";

const TERMINAL_STATES = new Set(["COMPLETED", "FAILED", "EXPIRED"]);
const POLL_INTERVAL_MS = 4000;

const EXPLORER_TX_URLS: Record<SupportedChain, string> = {
  base: "https://basescan.org/tx/",
  arbitrum: "https://arbiscan.io/tx/",
  optimism: "https://optimistic.etherscan.io/tx/",
};

const CHAIN_LABELS: Record<SupportedChain, string> = {
  base: "Base",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
};

function getExplorerUrl(hash: string, chain?: SupportedChain): string | null {
  if (!chain) return null;
  return `${EXPLORER_TX_URLS[chain]}${hash}`;
}

export default function TransferPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [status, setStatus] = useState<TransferStatusResponse | null>(null);
  const [receipt, setReceipt] = useState<TransferReceiptResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const data = await getBridgeStatus(id);
        if (cancelled) return;
        setStatus(data);
        setLoading(false);

        if (TERMINAL_STATES.has(data.status)) {
          getBridgeReceipt(id)
            .then((r) => { if (!cancelled) setReceipt(r); })
            .catch(() => undefined);
        } else {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          setNotFound(true);
        }
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [id]);

  /* ── Loading ─────────────────────────────────────────────────── */
  if (loading) {
    return (
      <section style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg style={{ flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle opacity="0.25" cx="12" cy="12" r="10" stroke="#4a5a8a" strokeWidth="4" />
              <path opacity="0.75" fill="#4a5a8a" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 12 12"
                  to="360 12 12"
                  dur="0.8s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
            <span style={{ color: "#5a6d9a", fontSize: 14 }}>Loading transfer…</span>
          </div>
        </div>
      </section>
    );
  }

  /* ── Not found ───────────────────────────────────────────────── */
  if (notFound || !status) {
    return (
      <section style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={card}>
          <h1 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "#e2e8ff", letterSpacing: "-0.3px" }}>
            Transfer not found
          </h1>
          <p style={{ margin: "0 0 20px", color: "#5a6d9a", fontSize: 14, lineHeight: 1.5 }}>
            No transfer with ID <code style={codeStyle}>{id}</code> could be located.
          </p>
          <a href="/" style={buttonGhost}>← Start a new transfer</a>
        </div>
      </section>
    );
  }

  const sourceTxHash = status.sourceTxHash ?? receipt?.sourceTxHash;
  const destTxHash = status.destinationTxHash ?? receipt?.destinationTxHash;

  return (
    <section style={{ maxWidth: 560, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <a href="/" style={{ ...buttonGhost, display: "inline-block", marginBottom: 16, fontSize: 13 }}>
          ← New transfer
        </a>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#f0f4ff", letterSpacing: "-0.4px" }}>
          Transfer Tracking
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: "#3d5070", fontFamily: "monospace" }}>
          {id}
        </p>
      </div>

      {/* Status stepper */}
      <TransferStatusComponent status={status.status} errorMessage={status.errorMessage} />

      {/* Receipt details */}
      {receipt && (
        <div style={{ ...card, marginTop: 16 }}>
          <p style={sectionLabel}>Transfer details</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            {receipt.sourceChain != null && (
              <Stat label="From" value={CHAIN_LABELS[receipt.sourceChain] ?? receipt.sourceChain} />
            )}
            {receipt.destinationChain != null && (
              <Stat label="To" value={CHAIN_LABELS[receipt.destinationChain] ?? receipt.destinationChain} />
            )}
            {receipt.sourceAmountSats != null && (
              <Stat label="Sent" value={`${Number(receipt.sourceAmountSats).toLocaleString()} sats`} />
            )}
            {receipt.receivedAmountSats != null && (
              <Stat label="Received" value={`${Number(receipt.receivedAmountSats).toLocaleString()} sats`} />
            )}
            {receipt.completedAt != null && (
              <Stat label="Completed" value={new Date(receipt.completedAt).toLocaleString()} />
            )}
            {receipt.failureReason != null && (
              <Stat label="Reason" value={receipt.failureReason} />
            )}
          </div>
        </div>
      )}

      {/* Last updated (always shown) */}
      {!receipt && (
        <div style={{ ...card, marginTop: 16 }}>
          <p style={sectionLabel}>Status</p>
          <div style={{ marginTop: 12 }}>
            <Stat label="Last updated" value={new Date(status.updatedAt).toLocaleString()} />
          </div>
        </div>
      )}

      {/* Transaction hashes */}
      {(sourceTxHash != null || destTxHash != null) && (
        <div style={{ ...card, marginTop: 16 }}>
          <p style={sectionLabel}>On-chain proof</p>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {sourceTxHash != null && (
              <TxRow
                label="Source"
                hash={sourceTxHash}
                explorerUrl={getExplorerUrl(sourceTxHash, receipt?.sourceChain)}
              />
            )}
            {destTxHash != null && (
              <TxRow
                label="Destination"
                hash={destTxHash}
                explorerUrl={getExplorerUrl(destTxHash, receipt?.destinationChain)}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#090e1f", border: "1px solid #1a2240", borderRadius: 10, padding: "10px 12px" }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "#3d5070",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "#c8d8f0" }}>{value}</div>
    </div>
  );
}

function TxRow({
  label,
  hash,
  explorerUrl,
}: {
  label: string;
  hash: string;
  explorerUrl: string | null;
}) {
  const short = hash.length > 20 ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : hash;
  return (
    <div
      style={{
        background: "#090e1f",
        border: "1px solid #1a2240",
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "#3d5070",
            marginBottom: 4,
          }}
        >
          {label} tx
        </div>
        <code
          style={{
            fontSize: 12,
            fontFamily: "monospace",
            color: "#7a90b8",
            letterSpacing: "0.01em",
          }}
        >
          {short}
        </code>
      </div>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flexShrink: 0,
            border: "1px solid #1e2d5a",
            borderRadius: 7,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 500,
            color: "#7a90b8",
            textDecoration: "none",
            whiteSpace: "nowrap",
            transition: "border-color 0.15s, color 0.15s",
          }}
        >
          View ↗
        </a>
      )}
    </div>
  );
}

/* ── Shared styles ──────────────────────────────────────────────── */

const card = {
  border: "1px solid #1e2a4a",
  borderRadius: 16,
  padding: "18px 16px",
  background: "#0f1630",
} as const;

const sectionLabel = {
  margin: 0,
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#3d5070",
};

const codeStyle = {
  fontSize: 12,
  fontFamily: "monospace",
  background: "#090e1f",
  border: "1px solid #1a2240",
  borderRadius: 5,
  padding: "1px 6px",
  color: "#7a90b8",
} as const;

const buttonGhost = {
  display: "inline-block",
  border: "1px solid #1e2d5a",
  borderRadius: 9,
  padding: "8px 16px",
  color: "#7a90b8",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 500,
} as const;
