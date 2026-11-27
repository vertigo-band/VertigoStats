import { useEffect, useRef, useState } from "react";
import { extractFromScreenshot } from "../extract/claude";
import { prepareImage } from "../extract/image";
import { SOURCE_LABEL, type Extraction } from "../extract/schemas";
import { saveExtraction, today } from "../db";
import { getSettings } from "../settings";
import Review from "./Review";

interface Item {
  id: string;
  name: string;
  previewUrl: string;
  status: "queued" | "reading" | "review" | "error" | "saved";
  blob?: Blob;
  base64?: string;
  extraction?: Extraction;
  error?: string;
  summary?: string;
  snapshotDate: string;
}

/** Best guess for the snapshot date: the date in a Pixel screenshot filename, else the file's date, else today. */
function guessDate(f: File): string {
  const m = f.name.match(/(20\d{2})(\d{2})(\d{2})/) ?? f.name.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  if (f.lastModified) {
    const d = new Date(f.lastModified);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return today();
}

export default function Import({ incoming, onIncomingConsumed, onGoSettings }: { incoming: File[]; onIncomingConsumed: () => void; onGoSettings: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const update = (id: string, patch: Partial<Item>) => setItems(list => list.map(it => (it.id === id ? { ...it, ...patch } : it)));
  const hasKey = !!getSettings().anthropicKey;

  async function read(item: Item) {
    update(item.id, { status: "reading", error: undefined });
    try {
      const { anthropicKey } = getSettings();
      const base64 = item.base64!;
      const extraction = await extractFromScreenshot(anthropicKey, base64, "image/jpeg");
      update(item.id, { status: "review", extraction });
    } catch (e: any) {
      update(item.id, { status: "error", error: e.message ?? String(e) });
    }
  }

  async function add(files: File[]) {
    const fresh: Item[] = [];
    for (const f of files.filter(f => f.type.startsWith("image/"))) {
      const { base64, blob } = await prepareImage(f);
      fresh.push({ id: crypto.randomUUID(), name: f.name, previewUrl: URL.createObjectURL(blob), status: "queued", blob, base64, snapshotDate: guessDate(f) });
    }
    setItems(list => [...fresh, ...list]);
    // Read two at a time: quick, without tripping rate limits.
    const queue = [...fresh];
    await Promise.all([0, 1].map(async () => { for (let it = queue.shift(); it; it = queue.shift()) await read(it); }));
  }

  useEffect(() => {
    if (incoming.length) { void add(incoming); onIncomingConsumed(); }
  }, [incoming]); // eslint-disable-line react-hooks/exhaustive-deps

  const pending = items.filter(i => i.status !== "saved");
  const saved = items.filter(i => i.status === "saved");

  return (
    <div className="space-y-3">
      {!hasKey && (
        <div className="card border-[#d28e05]/40 text-sm">
          Add your Anthropic API key first so the app can read screenshots.
          <button className="btn-primary mt-3 w-full" onClick={onGoSettings}>Open Settings</button>
        </div>
      )}
      <button className="card flex w-full flex-col items-center gap-1 border-dashed py-8 text-center active:bg-white/5" onClick={() => inputRef.current?.click()}>
        <span className="text-3xl text-[#338ced]">＋</span>
        <span className="font-medium">Choose screenshots</span>
        <span className="text-xs text-[#9c9c9c]">Meta Ads Manager · Hypeddit · Spotify for Artists. Tip: you can also Share → Promo Tracker from the screenshot preview.</span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden data-testid="file-input"
        onChange={ev => { const f = [...(ev.target.files ?? [])]; ev.target.value = ""; if (f.length) void add(f); }} />

      {pending.map(it =>
        it.status === "review" && it.extraction ? (
          <div key={it.id}>
            <p className="mb-1 text-xs text-[#9c9c9c]">Check what was read from <b className="text-[#efefef]">{SOURCE_LABEL[it.extraction.source]}</b>, fix anything wrong, then save.</p>
            <Review
              previewUrl={it.previewUrl}
              initial={it.extraction}
              snapshotDate={it.snapshotDate}
              onDiscard={() => setItems(list => list.filter(x => x.id !== it.id))}
              onSave={async (e, date) => {
                const n = await saveExtraction(e, date, it.blob!);
                const parts = [n.songs && `${n.songs} song${n.songs > 1 ? "s" : ""}`, n.ads && `${n.ads} ad${n.ads > 1 ? "s" : ""}`, n.links && `${n.links} link${n.links > 1 ? "s" : ""}`].filter(Boolean);
                update(it.id, { status: "saved", summary: `Saved ${parts.join(", ")} · ${SOURCE_LABEL[e.source]}` });
              }}
            />
          </div>
        ) : (
          <div key={it.id} className="card flex items-center gap-3">
            <img src={it.previewUrl} alt="" className="h-16 w-10 rounded object-cover" />
            <div className="min-w-0 flex-1 text-sm">
              {it.status === "error" ? (
                <>
                  <p className="text-[#efefef]">⚠ {it.error}</p>
                  <div className="mt-2 flex gap-2">
                    <button className="btn-ghost py-1.5" onClick={() => read(it)}>Retry</button>
                    <button className="btn-ghost py-1.5" onClick={() => setItems(l => l.filter(x => x.id !== it.id))}>Remove</button>
                  </div>
                </>
              ) : (
                <p className="animate-pulse text-[#9c9c9c]">{it.status === "queued" ? "Waiting…" : "Reading numbers…"}</p>
              )}
            </div>
          </div>
        ),
      )}

      {saved.length > 0 && (
        <div className="space-y-1">
          {saved.map(it => <p key={it.id} className="text-xs text-[#9c9c9c]">✓ {it.summary}</p>)}
        </div>
      )}
    </div>
  );
}
