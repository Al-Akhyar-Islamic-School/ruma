import { useState } from "react";
import { Header, type TabAktif } from "./components/Header";
import { RecordingView } from "./components/RecordingView";
import { AiView } from "./components/AiView";

export function App() {
  const [tabAktif, setTabAktif] = useState<TabAktif>("perekam");
  const [berkasInfo, setBerkasInfo] = useState<{ judul: string; path: string } | null>(null);

  const handleSelesaiRekam = (info: { judul: string; path: string }) => {
    setBerkasInfo(info);
    setTabAktif("cloud_ai");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f8fafc" }}>
      <Header tabAktif={tabAktif} onTabGanti={setTabAktif} />
      <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {tabAktif === "perekam" ? (
          <RecordingView
            onSelesaiRekam={handleSelesaiRekam}
            onBukaCloudAi={() => setTabAktif("cloud_ai")}
          />
        ) : tabAktif === "cloud_ai" ? (
          <AiView modeAwal="cloud" berkasInfo={berkasInfo} />
        ) : (
          <AiView modeAwal="lokal" berkasInfo={berkasInfo} />
        )}
      </main>
    </div>
  );
}
export default App;
