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
          A cross-chain swap bridge built to scale across 10+ networks and 100+ tokens.
        </p>
      </div>

      {/* What it is */}
      <Section title="What it does">
        <p>
          BridgX is a generic bridge for swapping assets across multiple networks. Hackathon MVP
          focused on WETH and wrapped BTC moving from Avalanche to Base, with a clear path to 10+
          chains and 100+ tokens.
        </p>
        <p style={{ marginTop: 12 }}>
          The core idea is to chain Circle CCTP (zero-fee USDC transfers) with Odos routing for the
          best swap rates. In internal tests it beats other bridges in ~50% of cases.
        </p>
      </Section>

      <Divider />

      {/* How it works */}
      <Section title="How it works">
        <ol style={{ paddingLeft: 18, margin: 0, lineHeight: 2 }}>
          <li>
            <strong style={{ color: "#c8d8f0", fontWeight: 600 }}>Quote.</strong>{" "}
            BridgX queries Odos to compute the optimal swap route and estimated output amount.
          </li>
          <li>
            <strong style={{ color: "#c8d8f0", fontWeight: 600 }}>Swap to USDC.</strong>{" "}
            The source token is swapped into USDC and burned through CCTP.
          </li>
          <li>
            <strong style={{ color: "#c8d8f0", fontWeight: 600 }}>Attest.</strong>{" "}
            Circle CCTP generates an attestation for the cross-chain transfer.
          </li>
          <li>
            <strong style={{ color: "#c8d8f0", fontWeight: 600 }}>Swap + deliver.</strong>{" "}
            The USDC arrives on the destination chain, swaps to the target token via Odos, and gets
            delivered to the user.
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
            description="Aggregates liquidity across DEXs to find the best swap route on each chain."
          />
          <TechCard
            name="Circle CCTP"
            role="Cross-chain settlement"
            description="Zero-fee USDC transfer layer that provides the cryptographic attestation between chains."
          />
        </div>
      </Section>

      <Divider />

      {/* Supported networks */}
      <Section title="Supported today">
        <p style={{ marginBottom: 12 }}>
          Live now (hackathon MVP):
        </p>
        <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 2, color: "#c8d8f0" }}>
          <li><span style={{ color: "#ff0420", marginRight: 8 }}>●</span> Avalanche → Base</li>
          <li><span style={{ color: "#7a90b8", marginRight: 8 }}>●</span> Tokens: WETH, BTC</li>
        </ul>
      </Section>

      <Divider />

      {/* Contact */}
      <Section title="Contact">
        <p>
          For questions, suggestions, or partnership inquiries, contact:
        </p>
        <ul style={{ paddingLeft: 18, margin: "8px 0 0", lineHeight: 2 }}>
          <li>
            <a href="https://www.linkedin.com/in/anton-bogomolov/" style={{ color: "#7a90b8" }}>
              https://www.linkedin.com/in/anton-bogomolov/
            </a>
          </li>
          <li>
            <a href="https://www.linkedin.com/in/alkindi-network/" style={{ color: "#7a90b8" }}>
              https://www.linkedin.com/in/alkindi-network/
            </a>
          </li>
        </ul>
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
