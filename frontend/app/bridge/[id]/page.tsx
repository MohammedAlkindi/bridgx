"use client";

import { useEffect, useMemo, useState } from "react";
import { advanceTransfer, getTransferById, STATUS_STEPS, statusLabel, type TransferStatus } from "../../mvp";

export default function TransferPage({ params }: { params: { id: string } }) {
  const [transfer, setTransfer] = useState(() => getTransferById(params.id));
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    setTransfer(getTransferById(params.id));
  }, [params.id]);

  useEffect(() => {
    if (!polling) return;

    const timer = window.setInterval(() => {
      const updated = advanceTransfer(params.id);
      if (!updated) {
        setPolling(false);
        return;
      }
      setTransfer(updated);
      if (updated.status === "completed" || updated.status === "failed") {
        setPolling(false);
      }
    }, 3500);

    return () => window.clearInterval(timer);
  }, [params.id, polling]);

  const currentStepIndex = useMemo(() => {
    if (!transfer) return -1;
    return STATUS_STEPS.indexOf(transfer.status);
  }, [transfer]);

  if (!transfer) {
    return (
      <section>
        <h1>Transfer not found</h1>
        <p style={{ color: "#b7c5ff" }}>No transfer with id {params.id} exists in local storage.</p>
        <a href="/" style={{ color: "#9eb3ff" }}>
          ← Back to new transfer
        </a>
      </section>
    );
  }

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Transfer Tracking</h1>
      <p style={{ color: "#b7c5ff" }}>
        Tracking transfer <strong>{transfer.id}</strong>
      </p>

      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Stat label="Asset" value={`${transfer.amount} ${transfer.asset}`} />
          <Stat label="Status" value={statusLabel(transfer.status)} />
          <Stat label="From" value={transfer.sourceChain} />
          <Stat label="To" value={transfer.destinationChain} />
          <Stat label="Created" value={new Date(transfer.createdAt).toLocaleString()} />
          <Stat label="ETA" value={`~${transfer.estimatedMinutes} minutes`} />
        </div>
      </div>

      <div style={{ ...card, marginTop: 16 }}>
        <strong>Execution Steps</strong>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {STATUS_STEPS.map((step, index) => (
            <StepRow key={step} step={step} active={index <= currentStepIndex} current={index === currentStepIndex} />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
        <a href="/" style={buttonGhost}>
          Start New Transfer
        </a>
        <button
          style={buttonPrimary}
          onClick={() => {
            const updated = advanceTransfer(params.id);
            if (updated) setTransfer(updated);
          }}
          disabled={transfer.status === "completed"}
        >
          Advance Manually
        </button>
      </div>
    </section>
  );
}

function StepRow({ step, active, current }: { step: TransferStatus; active: boolean; current: boolean }) {
  return (
    <div
      style={{
        border: `1px solid ${active ? "#5365b7" : "#2e3a69"}`,
        borderRadius: 10,
        padding: "10px 12px",
        background: active ? "#18234d" : "#101737",
      }}
    >
      <div style={{ fontWeight: current ? 700 : 500 }}>{statusLabel(step)}</div>
      <small style={{ color: "#9eb3ff" }}>{active ? "done/in-progress" : "pending"}</small>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#0f1632", border: "1px solid #263360", borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 12, color: "#9eb3ff" }}>{label}</div>
      <div style={{ marginTop: 5 }}>{value}</div>
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
  border: "1px solid #4c5f9d",
  borderRadius: 10,
  padding: "9px 12px",
  color: "#dce4ff",
  textDecoration: "none",
} as const;

const buttonPrimary = {
  border: "none",
  borderRadius: 10,
  padding: "10px 12px",
  color: "#ffffff",
  background: "linear-gradient(120deg, #4568ff, #7b44ff)",
  fontWeight: 600,
  cursor: "pointer",
} as const;
