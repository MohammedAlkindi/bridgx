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

  if (loading) {
    return (
      <section style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={loadingCard}>
          <svg style={{ display: "inline-block", marginRight: 10, verticalAlign: "middle" }} width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle opacity="0.25" cx="12" cy="12" r="10" stroke="#9eb3ff" strokeWidth="4" />
            <path opacity="0.75" fill="#9eb3ff" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
            </path>
          </svg>
          <span style={{ color: "#9eb3ff", fontSize: 14 }}>Loading transfer {id}…</span>
        </div>
      </section>
    );
  }

  if (notFound || !status) {
    return (
      <section style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={card}>
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#f0f4ff", letterSpacing: "-0.3px" }}>
            Transfer not found
          </h1>
          <p style={{ margin: "0 0 20px", color: "#7a90b8", fontSize: 14 }}>
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
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#f0f4ff", letterSpacing: "-0.3px" }}>
          Transfer Tracking
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "#6b7db3" }}>
          <code style={codeStyle}>{id}</code>
        </p>
      </div>

      {/* Status stepper */}
      <TransferStatusComponent status={status.status} errorMessage={status.errorMessage} />

      {/* Details card */}
      <div style={{ ...card, marginTop: 16 }}>
        <p style={sectionLabel}>Details</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          {receipt?.sourceChain != null && <Stat label="From" value={receipt.sourceChain} />}
          {receipt?.destinationChain != null && <Stat label="To" value={receipt.destinationChain} />}
          {receipt?.sourceAmountSats != null && (
            <Stat label="Sent" value={`${Number(receipt.sourceAmountSats).toLocaleString()} sats`} />
          )}
          {receipt?.receivedAmountSats != null && (
            <Stat label="Received" value={`${Number(receipt.receivedAmountSats).toLocaleString()} sats`} />
          )}
          <Stat label="Last updated" value={new Date(status.updatedAt).toLocaleString()} />
          {receipt?.completedAt != null && (
            <Stat label="Completed at" value={new Date(receipt.completedAt).toLocaleString()} />
          )}
          {receipt?.failureReason != null && (
            <Stat label="Reason" value={receipt.failureReason} />
          )}
        </div>
      </div>

      {/* Transaction hashes */}
      {(sourceTxHash != null || destTxHash != null) && (
        <div style={{ ...card, marginTop: 16 }}>
          <p style={sectionLabel}>Transaction hashes</p>
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

      <div style={{ marginTop: 20 }}>
        <a href="/" style={buttonGhost}>← Start a new transfer</a>
      </div>
    </section>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#0f1632", border: "1px solid #263360", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7db3", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "#e2e8ff" }}>{value}</div>
    </div>
  );
}

function TxRow({ label, hash, explorerUrl }: { label: string; hash: string; explorerUrl: string | null }) {
  const short = hash.length > 20 ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : hash;
  return (
    <div style={{ background: "#0f1632", border: "1px solid #263360", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7db3", marginBottom: 4 }}>
          {label} tx
        </div>
        <code style={{ fontSize: 12, fontFamily: "monospace", color: "#9eb3ff", wordBreak: "break-all", letterSpacing: "0.01em" }}>{short}</code>
      </div>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flexShrink: 0,
            border: "1px solid #263360",
            borderRadius: 7,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 500,
            color: "#9eb3ff",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          View ↗
        </a>
      )}
    </div>
  );
}

/* ── Shared styles ──────────────────────────────────────────────────── */

const card = {
  border: "1px solid #29335a",
  borderRadius: 16,
  padding: "20px 18px",
  background: "#121937",
} as const;

const loadingCard = {
  ...card,
  padding: "22px 18px",
} as const;

const sectionLabel = {
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#4a5a8a",
};

const codeStyle = {
  fontSize: 12,
  fontFamily: "monospace",
  background: "#0f1632",
  border: "1px solid #263360",
  borderRadius: 5,
  padding: "1px 6px",
  color: "#9eb3ff",
} as const;

const buttonGhost = {
  display: "inline-block",
  border: "1px solid #263360",
  borderRadius: 10,
  padding: "9px 18px",
  color: "#9eb3ff",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 500,
} as const;
