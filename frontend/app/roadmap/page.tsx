export const metadata = {
  title: "Roadmap — BridgX",
  description: "What we've shipped and what's coming next.",
};

type ItemStatus = "shipped" | "in-progress" | "planned" | "research";

type RoadmapItem = {
  label: string;
  status: ItemStatus;
};

type Phase = {
  name: string;
  period: string;
  items: RoadmapItem[];
};

const STATUS_LABEL: Record<ItemStatus, string> = {
  shipped: "Shipped",
  "in-progress": "In progress",
  planned: "Planned",
  research: "Research",
};

const STATUS_COLOR: Record<ItemStatus, string> = {
  shipped: "#10b981",
  "in-progress": "#F7931A",
  planned: "#4a6080",
  research: "#3d5070",
};

const PHASES: Phase[] = [
  {
    name: "v0.1 — Alpha",
    period: "Q1 2025",
    items: [
      { label: "Base, Arbitrum, and Optimism support", status: "shipped" },
      { label: "Wrapped BTC (WBTC) bridging", status: "shipped" },
      { label: "Live quote with USD conversion", status: "shipped" },
      { label: "On-chain transfer proof and receipt", status: "shipped" },
      { label: "MetaMask wallet integration", status: "shipped" },
      { label: "Transfer tracking with step progress", status: "shipped" },
    ],
  },
  {
    name: "v0.2 — Refinement",
    period: "Q2 2025",
    items: [
      { label: "UI/UX polish and responsiveness", status: "in-progress" },
      { label: "Quote freshness and expiry handling", status: "in-progress" },
      { label: "Smart retry on failed attestations", status: "planned" },
      { label: "Security audit preparation", status: "planned" },
      { label: "WalletConnect support", status: "planned" },
    ],
  },
  {
    name: "v0.3 — Expansion",
    period: "Q3 2025",
    items: [
      { label: "Polygon and zkSync support", status: "planned" },
      { label: "Scroll and Linea support", status: "planned" },
      { label: "Mobile-optimized interface", status: "planned" },
      { label: "Multi-asset support beyond WBTC", status: "planned" },
      { label: "Bridge aggregation (compare routes across bridges)", status: "planned" },
    ],
  },
  {
    name: "Future",
    period: "H2 2025+",
    items: [
      { label: "Native Bitcoin mainnet → L2 entry", status: "research" },
      { label: "Hardware wallet support (Ledger, Trezor)", status: "research" },
      { label: "Programmable bridge (API / SDK)", status: "research" },
      { label: "DAO governance and fee distribution", status: "research" },
    ],
  },
];

export default function RoadmapPage() {
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
          Roadmap
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "#5a6d9a", lineHeight: 1.6 }}>
          What we&rsquo;ve shipped and what&rsquo;s coming next. Updated as priorities evolve.
        </p>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          marginBottom: 32,
          paddingBottom: 24,
          borderBottom: "1px solid #1a2240",
        }}
      >
        {(Object.keys(STATUS_LABEL) as ItemStatus[]).map((s) => (
          <span
            key={s}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#5a6d9a",
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: STATUS_COLOR[s],
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      {/* Phases */}
      <div style={{ display: "grid", gap: 28 }}>
        {PHASES.map((phase) => (
          <div key={phase.name}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#c8d8f0",
                  letterSpacing: "-0.2px",
                }}
              >
                {phase.name}
              </h2>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#3d5070",
                }}
              >
                {phase.period}
              </span>
            </div>
            <div
              style={{
                border: "1px solid #1e2a4a",
                borderRadius: 12,
                background: "#0f1630",
                overflow: "hidden",
              }}
            >
              {phase.items.map((item, i) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "11px 16px",
                    borderTop: i > 0 ? "1px solid #0d1428" : undefined,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13.5,
                      color: item.status === "shipped" ? "#9eb3cc" : item.status === "in-progress" ? "#c8d8f0" : "#5a6d9a",
                      fontWeight: item.status === "in-progress" ? 500 : 400,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 500,
                      color: STATUS_COLOR[item.status],
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: STATUS_COLOR[item.status],
                        display: "inline-block",
                      }}
                    />
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <p
        style={{
          marginTop: 32,
          fontSize: 12,
          color: "#3d5070",
          lineHeight: 1.6,
          fontStyle: "italic",
        }}
      >
        Roadmap items reflect current priorities and may change. Dates are targets, not commitments.
      </p>

      {/* Nav */}
      <div style={{ marginTop: 24 }}>
        <a href="/" style={ghostLink}>← Back to bridge</a>
      </div>
    </article>
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
