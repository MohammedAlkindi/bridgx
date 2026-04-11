import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "BridgX | BTC Cross-Chain Bridge",
  description: "Seamless BTC cross-chain transfers — fast, minimal, and transparent.",
};

const NAV_LINKS = [
  { href: "/", label: "Bridge" },
  { href: "/about", label: "About" },
  { href: "/roadmap", label: "Roadmap" },
] as const;

const FOOTER_NAV = [
  { href: "/about", label: "About" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "'Inter', system-ui, Arial, sans-serif",
          background: "#090e1f",
          color: "#e2e8ff",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          {/* ── Header ───────────────────────────────────────────────── */}
          <header
            style={{
              borderBottom: "1px solid #1a2240",
              background: "#0d1326",
            }}
          >
            <div
              style={{
                maxWidth: 960,
                margin: "0 auto",
                padding: "0 24px",
                height: 56,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* Brand + Nav */}
              <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                <a
                  href="/"
                  style={{
                    color: "#f0f4ff",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: 17,
                    letterSpacing: "-0.4px",
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                  }}
                >
                  {/* BTC icon mark */}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "var(--brand-accent-color)",
                      fontSize: 14,
                      fontWeight: 800,
                      color: "white",
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    ₿
                  </span>
                  BridgX
                </a>

                <nav aria-label="Primary navigation" style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  {NAV_LINKS.map(({ href, label }) => (
                    <a
                      key={href}
                      href={href}
                      className="nav-link"
                      style={{
                        padding: "5px 11px",
                        borderRadius: 7,
                        fontSize: 13.5,
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                    >
                      {label}
                    </a>
                  ))}
                </nav>
              </div>

            </div>
          </header>

          {/* ── Main content ─────────────────────────────────────────── */}
          <main
            style={{
              flex: 1,
              width: "100%",
              maxWidth: 960,
              margin: "0 auto",
              padding: "48px 24px 72px",
            }}
          >
            {children}
          </main>

          {/* ── Footer ───────────────────────────────────────────────── */}
          <footer
            style={{
              borderTop: "1px solid #1a2240",
              background: "#0d1326",
            }}
          >
            <div
              style={{
                maxWidth: 960,
                margin: "0 auto",
                padding: "18px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 12, color: "#3d5070" }}>
                © 2026 BridgX &mdash; Powered by{" "}
                <span style={{ color: "#4a6080" }}>Odos</span>
                {" "}&amp;{" "}
                <span style={{ color: "#4a6080" }}>Circle CCTP</span>
              </span>

              <nav aria-label="Footer navigation" style={{ display: "flex", alignItems: "center", gap: 18 }}>
                {FOOTER_NAV.map(({ href, label }) => (
                  <a
                    key={href}
                    href={href}
                    className="nav-link"
                    style={{
                      fontSize: 12,
                      textDecoration: "none",
                    }}
                  >
                    {label}
                  </a>
                ))}
              </nav>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
