import { useEffect, useState } from "react";
import Songs from "./pages/Songs";
import Trends from "./pages/Trends";
import Import from "./pages/Import";
import Settings from "./pages/Settings";
import SyncBadge from "./components/SyncBadge";
import { takeSharedFiles } from "./sharedFiles";
import { getSettings } from "./settings";

type Tab = "songs" | "trends" | "import" | "settings";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "songs", label: "Songs", icon: "♪" },
  { id: "trends", label: "Trends", icon: "↗" },
  { id: "import", label: "Add", icon: "+" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>(() => (getSettings().anthropicKey ? "songs" : "settings"));
  const [incoming, setIncoming] = useState<File[]>([]);

  // Screenshots shared from the Android share sheet land here via the service worker.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("shared")) return;
    history.replaceState(null, "", location.pathname);
    takeSharedFiles().then(files => {
      if (files.length) { setIncoming(files); setTab("import"); }
    });
  }, []);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-[#0b0b0b]/90 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur">
        <h1 className="text-lg font-semibold">{TABS.find(t => t.id === tab)!.label === "Add" ? "Add screenshots" : TABS.find(t => t.id === tab)!.label}</h1>
        <SyncBadge />
      </header>
      <main className="flex-1 px-4 pb-28">
        {tab === "songs" && <Songs onAdd={() => setTab("import")} />}
        {tab === "trends" && <Trends />}
        {/* Import stays mounted so an in-progress batch survives tab switches. */}
        <div hidden={tab !== "import"}>
          <Import incoming={incoming} onIncomingConsumed={() => setIncoming([])} onGoSettings={() => setTab("settings")} />
        </div>
        {tab === "settings" && <Settings />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-white/10 bg-[#121212]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-xl">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] ${tab === t.id ? "text-[#338ced]" : "text-[#9c9c9c]"}`}
            >
              <span className={`flex h-7 items-center justify-center text-lg leading-none ${t.id === "import" ? "w-10 rounded-full bg-[#338ced] text-white" : ""}`}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
