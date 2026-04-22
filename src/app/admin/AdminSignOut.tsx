"use client";

import styles from "./admin.module.css";

export function AdminSignOut() {
  return (
    <button
      type="button"
      className={styles.signOutBtn}
      onClick={async () => {
        await fetch("/api/admin/auth", { method: "DELETE" });
        window.location.href = "/admin/login";
      }}
    >
      Sign out
    </button>
  );
}
