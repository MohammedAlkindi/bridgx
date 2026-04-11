import type { ReactNode } from "react";

export const metadata = {
  title: "About — BridgX",
  description: "What BridgX is, how it works, and the technology behind it.",
};

export default function AboutPage() {
  return (
    <article style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 26,
            fontWeight: 700,
            color: "#f0f4ff",
            letterSpacing: "-0.5px",
          }}
        >
          About BridgX
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "#5a6d9a", lineHeight: 1.6 }}>
          A non-custodial bridge for moving wrapped BTC across Ethereum L2 networks.
        </p>
      </div>

      {/* What it is */}
      <Section title="What it does">
        <p>
          BridgX enables users to move wrapped Bitcoin (WBTC and compatible BTC-pegged assets)
          between Ethereum Layer 2 networks — currently Base, Arbitrum, and Optimism — without
          any centralized custodian or manual wrapping step.
        </p>
        <p style={{ marginTop: 12 }}>
          Transfers are fully atomic: either the complete amount arrives at the destination
          or the transaction fails and nothing is lost. Every transfer produces an on-chain
          proof that can be independently verified.
        </p>
      </Section>

      <Divider />

      {/* How it works */}
      <Section title="How it works">
        <ol style={{ paddingLeft: 18, margin: 0, lineHeight: 2 }}>
          <li>
            <strong style={{ color: "#c8d8f0", fontWeight: 600 }}>Quote.</strong>{" "}
            BridgX queries live liquidity via Odos to compute the optimal swap route and
            estimated output amount.
          </li>
          <li>
            <strong style={{ color: "#c8d8f0", fontWeight: 600 }}>Lock.</strong>{" "}
            Your wallet signs a transaction that locks the BTC asset on the source chain.
          </li>
          <li>
            <strong style={{ color: "#c8d8f0", fontWeight: 600 }}>Attest.</strong>{" "}
            Circle's Cross-Chain Transfer Protocol (CCTP) generates a cryptographic attestation
            confirming the lock.
          </li>
          <li>
            <strong style={{ color: "#c8d8f0", fontWeight: 600 }}>Deliver.</strong>{" "}
            The attested message is submitted to the destination chain, releasing the equivalent
            amount to the recipient address.
          </li>
        </ol>
      </Section>

      <Divider />

      {/* Technology */}
      <Section title="Technology">
        <div style={{ display: "grid", gap: 12 }}>
          <TechCard
            name="Odos"
            role="Liquidity routing"
            description="Aggregates liquidity across multiple DEXs to find the best available swap route for each transfer."
          />
          <TechCard
            name="Circle CCTP"
            role="Cross-chain settlement"
            description="Circle's Cross-Chain Transfer Protocol provides the cryptographic attestation layer that enables trustless cross-chain message passing."
          />
        </div>
      </Section>

      <Divider />

      {/* Supported networks */}
      <Section title="Supported networks">
        <p style={{ marginBottom: 12 }}>
          BridgX currently supports transfers between the following Ethereum L2 networks:
        </p>
        <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 2, color: "#c8d8f0" }}>
          <li><span style={{ color: "#0052ff", marginRight: 8 }}>●</span> Base</li>
          <li><span style={{ color: "#28a0f0", marginRight: 8 }}>●</span> Arbitrum</li>
          <li><span style={{ color: "#ff0420", marginRight: 8 }}>●</span> Optimism</li>
        </ul>
        <p style={{ marginTop: 12 }}>
          Additional network support is planned. See the{" "}
          <a href="/roadmap" style={{ color: "#7a90b8", textDecoration: "underline" }}>
            roadmap
          </a>{" "}
          for details.
        </p>
      </Section>

      <Divider />

      {/* Contact */}
      <Section title="Contact">
        <p>
          For questions, security reports, or partnership inquiries, open an issue on the
          project repository or reach out to the team directly.
        </p>
      </Section>

      {/* Nav */}
      <div style={{ marginTop: 36 }}>
        <a href="/" style={ghostLink}>← Back to bridge</a>
      </div>
    </article>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "#4a5a8a",
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 14, color: "#9eb3cc", lineHeight: 1.7 }}>
        {children}
      </div>
    </section>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #1a2240", marginBottom: 32 }} />;
}

function TechCard({
  name,
  role,
  description,
}: {
  name: string;
  role: string;
  description: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #1e2a4a",
        borderRadius: 12,
        padding: "14px 16px",
        background: "#0f1630",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#c8d8f0" }}>{name}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "#4a5a8a",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {role}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "#7a90b8", lineHeight: 1.6 }}>
        {description}
      </p>
    </div>
  );
}

const ghostLink = {
  display: "inline-block",
  border: "1px solid #1e2d5a",
  borderRadius: 9,
  padding: "8px 16px",
  color: "#7a90b8",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 500,
} as const;
