import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "BridgX | Cross-Chain Bridge MVP",
  description: "A functional MVP frontend for creating and tracking cross-chain token transfers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Inter, Arial, sans-serif", background: "#0b1020", color: "#e6ecff" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <header
            style={{
              borderBottom: "1px solid #1b2446",
              background: "linear-gradient(120deg, #121936 0%, #10172f 100%)",
            }}
          >
            <div
              style={{
                maxWidth: 1000,
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
              }}
            >
              <a href="/" style={{ color: "#f6f8ff", textDecoration: "none", fontWeight: 700, fontSize: 20 }}>
                BridgX MVP
              </a>
              <nav style={{ display: "flex", gap: 16, fontSize: 14 }}>
                <a href="/" style={{ color: "#9eb3ff", textDecoration: "none" }}>
                  New Transfer
                </a>
              </nav>
            </div>
          </header>

          <main style={{ flex: 1, width: "100%", maxWidth: 1000, margin: "0 auto", padding: "24px 20px 40px" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
