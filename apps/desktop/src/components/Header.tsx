import { Mic, Cloud, Cpu, Monitor } from "lucide-react";

export type TabAktif = "perekam" | "cloud_ai" | "ai_lokal";

export function Header({
  tabAktif,
  onTabGanti,
}: {
  tabAktif: TabAktif;
  onTabGanti: (tab: TabAktif) => void;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 24px",
        background: "#153e35",
        color: "#ffffff",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          <span style={{ fontSize: "22px", fontWeight: "800", letterSpacing: "-0.03em" }}>
            ruma<span style={{ color: "#a3e635" }}>.</span>
          </span>
          <span style={{ fontSize: "11px", color: "#a7f3d0", fontWeight: "500", marginLeft: "4px" }}>
            Desktop
          </span>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(255, 255, 255, 0.12)",
            padding: "4px 10px",
            borderRadius: "9999px",
            fontSize: "11px",
            color: "#d1fae5",
          }}
        >
          <Monitor size={12} />
          <span>Sekolah Islam Al Akhyar</span>
        </div>
      </div>

      {/* 3 Tab Navigasi Utama */}
      <div
        style={{
          display: "flex",
          background: "rgba(0, 0, 0, 0.25)",
          padding: "4px",
          borderRadius: "10px",
          gap: "4px",
        }}
      >
        <button
          onClick={() => onTabGanti("perekam")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 14px",
            borderRadius: "7px",
            border: "none",
            background: tabAktif === "perekam" ? "#ffffff" : "transparent",
            color: tabAktif === "perekam" ? "#153e35" : "#e2e8f0",
            fontWeight: tabAktif === "perekam" ? "700" : "500",
            fontSize: "13px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <Mic size={15} />
          <span>Perekam Rapat</span>
        </button>

        <button
          onClick={() => onTabGanti("cloud_ai")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 14px",
            borderRadius: "7px",
            border: "none",
            background: tabAktif === "cloud_ai" ? "#ffffff" : "transparent",
            color: tabAktif === "cloud_ai" ? "#153e35" : "#e2e8f0",
            fontWeight: tabAktif === "cloud_ai" ? "700" : "500",
            fontSize: "13px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <Cloud size={15} color={tabAktif === "cloud_ai" ? "#153e35" : "#a3e635"} />
          <span>Cloud AI (Gemini & Cloudflare)</span>
        </button>

        <button
          onClick={() => onTabGanti("ai_lokal")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 14px",
            borderRadius: "7px",
            border: "none",
            background: tabAktif === "ai_lokal" ? "#ffffff" : "transparent",
            color: tabAktif === "ai_lokal" ? "#153e35" : "#e2e8f0",
            fontWeight: tabAktif === "ai_lokal" ? "700" : "500",
            fontSize: "13px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <Cpu size={15} />
          <span>AI Lokal (Offline)</span>
        </button>
      </div>
    </header>
  );
}
