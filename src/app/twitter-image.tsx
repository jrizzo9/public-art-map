import { ImageResponse } from "next/og";
import { SITE_ORG_NAME, SITE_PRODUCT_NAME } from "@/lib/site";
import { env } from "@/lib/env";

export const alt = `${SITE_PRODUCT_NAME} — ${SITE_ORG_NAME}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL();
  const hostname = (() => {
    try {
      return new URL(siteUrl).hostname;
    } catch {
      return siteUrl;
    }
  })();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background:
            "radial-gradient(1200px 630px at 15% 20%, rgba(124,58,237,0.35) 0%, rgba(17,24,39,1) 55%), linear-gradient(135deg, #0b1220 0%, #020617 100%)",
          color: "white",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
        }}
      >
        <div style={{ fontSize: 22, opacity: 0.9 }}>{SITE_ORG_NAME}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -1 }}>
            {SITE_PRODUCT_NAME}
          </div>
          <div style={{ fontSize: 32, opacity: 0.92 }}>
            Explore public art in Waco
          </div>
        </div>
        <div style={{ fontSize: 20, opacity: 0.72 }}>{hostname}</div>
      </div>
    ),
    size,
  );
}

