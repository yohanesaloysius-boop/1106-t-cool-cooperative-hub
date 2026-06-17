export type LogoFit = "contain" | "cover";

/** Fetch a remote image URL and convert it to a base64 data URL. */
export async function urlToDataUrl(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Render a logo into a fixed square box applying object-fit (contain/cover),
 * returning a PNG data URL sized boxPx × boxPx. "contain" letterboxes with a
 * transparent background; "cover" crops to fill. Ideal for embedding neatly in PDFs.
 */
export async function fitImageToSquare(
  url: string | null | undefined,
  fit: LogoFit = "contain",
  boxPx = 240,
): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const dataUrl = (await urlToDataUrl(url)) ?? url;
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = boxPx;
    canvas.height = boxPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;

    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return dataUrl;

    if (fit === "cover") {
      const scale = Math.max(boxPx / iw, boxPx / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(img, (boxPx - dw) / 2, (boxPx - dh) / 2, dw, dh);
    } else {
      const scale = Math.min(boxPx / iw, boxPx / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(img, (boxPx - dw) / 2, (boxPx - dh) / 2, dw, dh);
    }
    return canvas.toDataURL("image/png");
  } catch {
    return urlToDataUrl(url);
  }
}
