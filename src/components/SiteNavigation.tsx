"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteNavigation.module.css";

const SUBMIT_ENABLED = process.env.NEXT_PUBLIC_SUBMIT_ENABLED === "true";

function startsWith(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNavigation() {
  const pathname = usePathname();

  const artActive =
    pathname === "/art" ||
    (pathname.startsWith("/art/") && !pathname.startsWith("/embed"));

  const links: { href: string; label: string; active: boolean }[] = [
    { href: "/?fs=1", label: "Map", active: pathname === "/" },
    { href: "/art", label: "Art", active: artActive },
    ...(SUBMIT_ENABLED
      ? [{ href: "/submit", label: "Submit", active: startsWith("/submit", pathname) }]
      : []),
    {
      href: "/admin",
      label: "Admin",
      active: pathname.startsWith("/admin"),
    },
  ];

  return (
    <nav className={styles.nav} aria-label="Site navigation" data-site-nav>
      {links.map(({ href, label, active }) => (
        <Link
          key={href}
          href={href}
          prefetch={href !== "/submit"}
          className={`${styles.link} ${active ? styles.linkActive : ""}`}
          aria-current={active ? "page" : undefined}
          transitionTypes={["nav-forward"]}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
