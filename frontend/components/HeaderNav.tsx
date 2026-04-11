"use client";

import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Bridge", disabled: false },
  { href: "/about", label: "About", disabled: false },
  { href: "/roadmap", label: "Roadmap", disabled: true },
] as const;

export default function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {NAV_LINKS.map(({ href, label, disabled }) => {
        const isActive = pathname === href;
        const className = [
          "nav-link",
          isActive ? "nav-link-active" : "",
          disabled ? "nav-link-disabled" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const sharedStyle = {
          padding: "5px 11px",
          borderRadius: 7,
          fontSize: 13.5,
          fontWeight: 500,
          textDecoration: "none",
        } as const;

        if (disabled || isActive) {
          return (
            <span key={href} className={className} style={sharedStyle}>
              {label}
            </span>
          );
        }

        return (
          <a key={href} href={href} className={className} style={sharedStyle}>
            {label}
          </a>
        );
      })}
    </nav>
  );
}
