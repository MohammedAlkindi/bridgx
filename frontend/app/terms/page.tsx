import type { ReactNode } from "react";

export const metadata = {
  title: "Terms of Use — BridgX",
  description: "Terms governing use of the BridgX bridge interface.",
};

export default function TermsPage() {
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
          Terms of Use
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "#3d5070" }}>Last updated: April 2025</p>
      </div>

      <Section title="Acceptance">
        <p>
          By accessing and using BridgX (the &ldquo;Interface&rdquo;), you agree to these terms.
          If you do not agree, do not use the Interface. These terms may be updated at any time;
          continued use constitutes acceptance of any changes.
        </p>
      </Section>

      <Divider />

      <Section title="Nature of the service">
        <p>
          BridgX is a non-custodial interface for interacting with decentralized blockchain
          protocols. We do not custody funds, act as a counterparty to any transaction, or
          provide financial services.
        </p>
        <p style={{ marginTop: 10 }}>
          All transactions are executed directly on-chain via smart contracts. BridgX has no
          ability to reverse, pause, or modify any transaction once submitted to the blockchain.
        </p>
      </Section>

      <Divider />

      <Section title="Alpha software">
        <p>
          BridgX is currently in <strong style={{ color: "#c8d8f0" }}>alpha</strong>. The
          software has not been audited. It may contain bugs, vulnerabilities, or errors that
          could result in partial or total loss of funds.
        </p>
        <p style={{ marginTop: 10 }}>
          Use only amounts you can afford to lose during this phase. Do not use BridgX with
          production wallets or significant balances until a security audit has been completed
          and published.
        </p>
      </Section>

      <Divider />

      <Section title="Your responsibilities">
        <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 2 }}>
          <li>You are solely responsible for the security of your wallet and private keys.</li>
          <li>You must verify recipient addresses before initiating any transfer.</li>
          <li>You are responsible for understanding the tax implications of your transactions.</li>
          <li>
            You must comply with all applicable laws in your jurisdiction, including any
            restrictions on digital asset transfers.
          </li>
          <li>
            You must not use BridgX for any illegal purpose, including money laundering or
            sanctions evasion.
          </li>
        </ul>
      </Section>

      <Divider />

      <Section title="Prohibited use">
        <p>You may not use BridgX if you are:</p>
        <ul style={{ paddingLeft: 18, margin: "10px 0 0", lineHeight: 2 }}>
          <li>Located in a jurisdiction where use of digital assets is prohibited</li>
          <li>On any sanctions list (OFAC or equivalent)</li>
          <li>Using the Interface to evade legal or regulatory requirements</li>
        </ul>
      </Section>

      <Divider />

      <Section title="Disclaimers">
        <p>
          THE INTERFACE IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
          IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY LAW, BRIDGX DISCLAIMS ALL WARRANTIES
          INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p style={{ marginTop: 10 }}>
          BRIDGX SHALL NOT BE LIABLE FOR ANY LOSS OF FUNDS, DATA, OR PROFITS, OR FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF
          THE INTERFACE.
        </p>
      </Section>

      <Divider />

      <Section title="Protocol risk">
        <p>
          BridgX relies on third-party protocols (Odos, Circle CCTP) and underlying blockchain
          networks. Failures, exploits, or outages in any of these layers are outside our
          control and may affect transfer completion.
        </p>
      </Section>

      <Divider />

      <Section title="Contact">
        <p>
          For questions about these terms, open an issue on the project repository or contact
          the team through available channels.
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
