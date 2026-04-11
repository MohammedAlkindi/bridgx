"use client";

import { useEffect, useState } from "react";
import TransferStatusComponent from "../../components/TransferStatus";
import { getBridgeReceipt, getBridgeStatus } from "../../lib/api";
import type { TransferReceiptResponse, TransferStatusResponse } from "../../types";

const TERMINAL_STATES = new Set(["COMPLETED", "FAILED", "EXPIRED"]);
const POLL_INTERVAL_MS = 4000;

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
      <section>
        <p style={{ color: "#9eb3ff" }}>Loading transfer {id}…</p>
      </section>
    );
  }

  if (notFound || !status) {
    return (
      <section>
        <h1 style={{ marginTop: 0 }}>Transfer not found</h1>
        <p style={{ color: "#b7c5ff" }}>
          No transfer with id <code>{id}</code> could be located.
        </p>
        <a href="/" style={{ color: "#9eb3ff" }}>
          ← Start a new transfer
        </a>
      </section>
    );
  }

  const sourceTxHash = status.sourceTxHash ?? receipt?.sourceTxHash;
  const destTxHash = status.destinationTxHash ?? receipt?.destinationTxHash;

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Transfer Tracking</h1>
      <p style={{ color: "#b7c5ff", marginTop: 0 }}>
        ID: <code style={{ fontSize: 13 }}>{id}</code>
      </p>

      <TransferStatusComponent status={status.status} errorMessage={status.errorMessage} />

      <div style={{ ...card, marginTop: 16 }}>
        <strong>Details</strong>
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {receipt?.sourceChain != null && <Stat label="From" value={receipt.sourceChain} />}
          {receipt?.destinationChain != null && <Stat label="To" value={receipt.destinationChain} />}
          {receipt?.sourceAmountSats != null && (
            <Stat label="Sent" value={`${receipt.sourceAmountSats} sats`} />
          )}
          {receipt?.receivedAmountSats != null && (
            <Stat label="Received" value={`${receipt.receivedAmountSats} sats`} />
          )}
          <Stat label="Last updated" value={new Date(status.updatedAt).toLocaleString()} />
          {receipt?.completedAt != null && (
            <Stat label="Completed at" value={new Date(receipt.completedAt).toLocaleString()} />
          )}
        </div>
      </div>

      {(sourceTxHash != null || destTxHash != null) && (
        <div style={{ ...card, marginTop: 16 }}>
          <strong>Transaction Hashes</strong>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {sourceTxHash != null && <TxRow label="Source" hash={sourceTxHash} />}
            {destTxHash != null && <TxRow label="Destination" hash={destTxHash} />}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <a href="/" style={buttonGhost}>
          ← Start a new transfer
        </a>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#0f1632",
        border: "1px solid #263360",
        borderRadius: 10,
        padding: 10,
      }}
    >
      <div style={{ fontSize: 12, color: "#9eb3ff" }}>{label}</div>
      <div style={{ marginTop: 4 }}>{value}</div>
    </div>
  );
}

function TxRow({ label, hash }: { label: string; hash: string }) {
  const short = hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : hash;
  return (
    <div
      style={{
        background: "#0f1632",
        border: "1px solid #263360",
        borderRadius: 10,
        padding: "8px 12px",
      }}
    >
      <div style={{ fontSize: 12, color: "#9eb3ff", marginBottom: 4 }}>{label} tx</div>
      <code style={{ fontSize: 12, wordBreak: "break-all" }}>{short}</code>
    </div>
  );
}

const card = {
  border: "1px solid #29335a",
  borderRadius: 14,
  padding: 16,
  background: "#121937",
} as const;

const buttonGhost = {
  display: "inline-block",
  border: "1px solid #4c5f9d",
  borderRadius: 10,
  padding: "9px 14px",
  color: "#dce4ff",
  textDecoration: "none",
} as const;
