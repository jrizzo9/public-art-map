import { BrandLogo } from "@/components/BrandLogo";
import { SITE_PRODUCT_NAME } from "@/lib/site";
import styles from "./SiteBrandBar.module.css";

type Props = {
  /** Use `h1` only on routes where this is the primary page heading (home). Else use `p` so artwork/other `h1`s stay correct. */
  titleAs?: "h1" | "p";
};

export function SiteBrandBar({ titleAs = "p" }: Props) {
  const Title = titleAs;

  return (
    <div className={styles.brandBar} data-site-brand-bar>
      <BrandLogo className={styles.brandLogo} imgClassName={styles.brandLogoImg} />
      <Title className={styles.title}>{SITE_PRODUCT_NAME}</Title>
    </div>
  );
}
