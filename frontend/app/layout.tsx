import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "BridgX | BTC Cross-Chain Bridge",
  description: "Seamless BTC cross-chain transfers — fast, minimal, and transparent.",
};

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
                alignItems: "center",
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
                  letterSpacing: "-0.4px",
                }}
              >
                BridgX
              </a>
              <span
                style={{
                  color: "#263360",
                  fontSize: 15,
                  userSelect: "none",
                  padding: "0 4px",
                }}
              >
                |
              </span>
              <span
                style={{
                  color: "#4a5a8a",
                  fontSize: 13,
                  fontWeight: 400,
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
              padding: "48px 24px 72px",
            }}
          >
            {children}
          </main>

          <footer
            style={{
              borderTop: "1px solid #1a2240",
              background: "#0d1326",
              padding: "14px 24px",
              textAlign: "center",
              fontSize: 12,
              color: "#4a5a8a",
            }}
          >
            BridgX &mdash; Powered by Odos &amp; Circle CCTP
          </footer>
        </div>
      </body>
    </html>
  );
}
