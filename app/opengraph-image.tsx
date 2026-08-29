import { ImageResponse } from "next/og";

export const alt = "Paradox — Explore every future before your users do";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#04060c", color: "#f2f5fc", padding: "58px 64px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.16)", paddingBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 700 }}><span style={{ width: 18, height: 18, border: "1px solid #f2f5fc", transform: "rotate(45deg)", display: "flex" }} />Paradox</div>
        <div style={{ fontSize: 18, color: "#9aa4bb" }}>A testing tool for WebMCP apps</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", color: "#7fb1ff", fontSize: 18, letterSpacing: 2, textTransform: "uppercase" }}>Human + agent · one live state</div>
        <div style={{ display: "flex", maxWidth: 970, fontSize: 76, fontWeight: 700, lineHeight: 0.98, letterSpacing: -4 }}>Explore every future before your users do.</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.16)", paddingTop: 24, fontSize: 20 }}>
        <span>Deterministic bounded exploration</span><span style={{ color: "#ff8b96" }}>$2,399 inspected → $23,999 approved</span>
      </div>
    </div>,
    size,
  );
}
