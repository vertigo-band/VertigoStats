import { useEffect, useState } from "react";
import { connectGoogle, onSyncState, sheetUrl, type SyncState } from "../sync/sheets";

export default function SyncBadge() {
  const [s, setS] = useState<SyncState>({ status: "idle" });
  useEffect(() => onSyncState(setS), []);
  if (s.status === "idle") return null;
  if (s.status === "needs-auth")
    return <button className="chip border-[#d28e05]/60 text-[#efefef]" onClick={() => connectGoogle().catch(e => alert(e.message))}>⟳ {s.message}</button>;
  if (s.status === "syncing") return <span className="chip border-white/15 text-[#9c9c9c]">Syncing…</span>;
  if (s.status === "error") return <span className="chip border-[#eb6263]/60 text-[#efefef]" title={s.message}>⚠ Sync failed</span>;
  const url = sheetUrl();
  return url ? <a className="chip border-white/15 text-[#9c9c9c]" href={url} target="_blank" rel="noreferrer">✓ Synced to Sheets</a> : null;
}
