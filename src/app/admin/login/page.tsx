import type { Metadata } from "next";
import { SiteBrandBar } from "@/components/SiteBrandBar";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className={styles.shell}>
      <div className={styles.wrap}>
        <SiteBrandBar />
        <div className={styles.card}>
          <h1 className={styles.title}>Admin</h1>
          <p className={styles.lead}>Enter the admin password to continue.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
