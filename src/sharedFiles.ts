/** Read (and remove) screenshots the service worker stashed from an Android share. */
export async function takeSharedFiles(): Promise<File[]> {
  if (!("caches" in window)) return [];
  const cache = await caches.open("shared-screenshots");
  const keys = await cache.keys();
  const files: File[] = [];
  for (const k of keys) {
    const r = await cache.match(k);
    if (r) {
      const blob = await r.blob();
      files.push(new File([blob], decodeURIComponent(r.headers.get("X-Name") ?? "screenshot"), { type: blob.type }));
    }
    await cache.delete(k);
  }
  return files;
}
