import type { ReactNode } from "react";

export const metadata = {
  title: "Privacy Policy — BridgX",
  description: "How BridgX handles data and what information is collected.",
};

export default function PrivacyPage() {
  return (
    <article style={{ maxWidth: 600, margin: "0 auto" }}>
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
          Privacy Policy
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "#3d5070" }}>Last updated: April 2025</p>
      </div>

      <Section title="Overview">
        <p>
          BridgX is a non-custodial bridge. We do not create accounts, store passwords,
          or collect personally identifiable information. All bridge activity occurs
          on-chain and is publicly visible on the respective blockchain explorers.
        </p>
      </Section>

      <Divider />

      <Section title="What we collect">
        <p>We collect minimal data strictly necessary to operate the service:</p>
        <ul style={{ paddingLeft: 18, margin: "10px 0 0", lineHeight: 2 }}>
          <li>
            <strong style={{ color: "#c8d8f0", fontWeight: 600 }}>Wallet addresses.</strong>{" "}
            Your connected wallet address is used to fetch quotes and initiate transfers.
            It is not stored on our servers beyond the duration of your session.
          </li>
          <li>
            <strong style={{ color: "#c8d8f0", fontWeight: 600 }}>Transfer data.</strong>{" "}
            Transfer IDs, chain selections, and amounts are processed to facilitate bridging.
            Completed transfers produce a permanent on-chain record.
          </li>
          <li>
            <strong style={{ color: "#c8d8f0", fontWeight: 600 }}>Anonymous usage metrics.</strong>{" "}
            We may collect aggregate, non-identifiable analytics (page views, error rates)
            to improve the product. No personal data is associated with these metrics.
          </li>
        </ul>
      </Section>

      <Divider />

      <Section title="What we do not collect">
        <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 2 }}>
          <li>Names, email addresses, or contact information</li>
          <li>IP addresses linked to wallet identities</li>
          <li>Private keys or seed phrases (never share these with anyone)</li>
          <li>Browser history or cross-site tracking data</li>
        </ul>
      </Section>

      <Divider />

      <Section title="Third-party services">
        <p>
          BridgX integrates with the following third-party protocols to process transfers.
          Their respective privacy policies apply to data they process:
        </p>
        <ul style={{ paddingLeft: 18, margin: "10px 0 0", lineHeight: 2 }}>
          <li>
            <strong style={{ color: "#c8d8f0", fontWeight: 600 }}>Odos</strong> — used for
            liquidity routing and swap quote computation.
          </li>
          <li>
            <strong style={{ color: "#c8d8f0", fontWeight: 600 }}>Circle CCTP</strong> — used
            for cross-chain message attestation and settlement.
          </li>
        </ul>
      </Section>

      <Divider />

      <Section title="On-chain data">
        <p>
          All bridge transactions are recorded on public blockchains (Base, Arbitrum, Optimism).
          This data is permanent, public, and outside of our control. Anyone can view transfer
          details by inspecting the relevant block explorer.
        </p>
      </Section>

      <Divider />

      <Section title="Changes to this policy">
        <p>
          We may update this policy as the product evolves. Material changes will be noted
          at the top of this page with a revised date.
        </p>
      </Section>

      <div style={{ marginTop: 36 }}>
        <a href="/" style={ghostLink}>← Back to bridge</a>
      </div>
    </article>
  );
}

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
      <div style={{ fontSize: 14, color: "#9eb3cc", lineHeight: 1.75 }}>{children}</div>
    </section>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #1a2240", marginBottom: 32 }} />;
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
