import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "BridgX | BTC Cross-Chain Bridge",
  description: "Seamless BTC cross-chain transfers — fast, minimal, and transparent.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Inter, system-ui, Arial, sans-serif",
          background: "#090e1f",
          color: "#e2e8ff",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
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
                padding: "18px 24px",
                display: "flex",
                alignItems: "baseline",
                gap: 14,
              }}
            >
              <a
                href="/"
                style={{
                  color: "#f0f4ff",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 20,
                  letterSpacing: "-0.3px",
                }}
              >
                BridgX
              </a>
              <span
                style={{
                  color: "#4a5a8a",
                  fontSize: 13,
                  fontWeight: 400,
                  letterSpacing: "0.1px",
                }}
              >
                BTC cross-chain bridge
              </span>
            </div>
          </header>

          <main
            style={{
              flex: 1,
              width: "100%",
              maxWidth: 960,
              margin: "0 auto",
              padding: "32px 24px 56px",
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
