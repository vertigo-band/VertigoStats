/** Downscale a screenshot in a canvas and return JPEG base64 + a Blob for storage. */
export async function prepareImage(file: Blob, maxEdge = 2400): Promise<{ base64: string; blob: Blob; mediaType: "image/jpeg" }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error("Could not encode image"))), "image/jpeg", 0.9));
  const base64 = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1]);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
  return { base64, blob, mediaType: "image/jpeg" };
}
