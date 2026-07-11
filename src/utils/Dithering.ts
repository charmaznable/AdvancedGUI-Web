// Floyd–Steinberg dithering to the Minecraft map palette for dev-mode preview
import { snapRgb } from "./MapColorPalette";

function clampByte(c: number): number {
  return c < 0 ? 0 : c > 255 ? 255 : c;
}

// Floyd–Steinberg dithering of RGBA buffer (in place) to the map palette
export function ditherImageDataToMapColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  intensity = 100
): void {
  const k = Math.max(0, Math.min(100, intensity)) / 100;
  const n = width * height;
  const dr = new Int32Array(n);
  const dg = new Int32Array(n);
  const db = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    dr[i] = data[i * 4];
    dg[i] = data[i * 4 + 1];
    db[i] = data[i * 4 + 2];
  }

  const spread = (e: number, num: number) => Math.trunc((num / 16) * e);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const di = idx * 4;

      if (data[di + 3] < 122) {
        data[di] = data[di + 1] = data[di + 2] = data[di + 3] = 0;
        continue;
      }

      const or = dr[idx];
      const og = dg[idx];
      const ob = db[idx];
      const packed = snapRgb(clampByte(or), clampByte(og), clampByte(ob));
      const nr = (packed >> 16) & 0xff;
      const ng = (packed >> 8) & 0xff;
      const nb = packed & 0xff;

      data[di] = nr;
      data[di + 1] = ng;
      data[di + 2] = nb;
      data[di + 3] = 255;

      const er = Math.trunc(k * (or - nr));
      const eg = Math.trunc(k * (og - ng));
      const eb = Math.trunc(k * (ob - nb));

      const right = x + 1 < width;
      const down = y + 1 < height;
      if (right) {
        dr[idx + 1] += spread(er, 7);
        dg[idx + 1] += spread(eg, 7);
        db[idx + 1] += spread(eb, 7);
      }
      if (x - 1 >= 0 && down) {
        dr[idx + width - 1] += spread(er, 3);
        dg[idx + width - 1] += spread(eg, 3);
        db[idx + width - 1] += spread(eb, 3);
      }
      if (down) {
        dr[idx + width] += spread(er, 5);
        dg[idx + width] += spread(eg, 5);
        db[idx + width] += spread(eb, 5);
      }
      if (right && down) {
        dr[idx + width + 1] += spread(er, 1);
        dg[idx + width + 1] += spread(eg, 1);
        db[idx + width + 1] += spread(eb, 1);
      }
    }
  }
}

const ditherCanvasCache = new Map<string, HTMLCanvasElement>();

// Returns cached offscreen canvas with resized and dithered source
export function getDitheredCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
  cacheKey: string,
  intensity = 100
): HTMLCanvasElement | null {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const key = `${cacheKey}@${w}x${h}@${intensity}`;

  const cached = ditherCanvasCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;
  try {
    ctx.drawImage(source, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    ditherImageDataToMapColors(imageData.data, w, h, intensity);
    ctx.putImageData(imageData, 0, 0);
  } catch {
    return null;
  }

  if (ditherCanvasCache.size >= 256) ditherCanvasCache.clear();
  ditherCanvasCache.set(key, canvas);
  return canvas;
}

export function clearDitherCache(): void {
  ditherCanvasCache.clear();
}

