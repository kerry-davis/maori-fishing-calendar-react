// Simple in-browser image compression utility (no external deps)
// - Uses createImageBitmap when available (respects EXIF orientation)
// - Falls back to HTMLImageElement + canvas
// - Returns original bytes on failure or non-image input

export type CompressOptions = {
  maxDimension?: number; // max width/height
  quality?: number; // 0..1 for JPEG/WebP
  convertTo?: 'image/jpeg' | 'image/webp' | null; // target mime; default picks jpeg for photos
};

export async function compressImage(
  inputBytes: Uint8Array,
  inputMime: string,
  opts: CompressOptions = {}
): Promise<{ bytes: Uint8Array; mime: string }> {
  try {
    if (!inputMime?.startsWith('image/')) {
      return { bytes: inputBytes, mime: inputMime };
    }

    const maxDim = opts.maxDimension ?? 1080;
    const quality = opts.quality ?? 0.85;
    // Prefer JPEG for typical camera photos; WebP if explicitly requested
    const targetMime = opts.convertTo ?? (inputMime === 'image/webp' ? 'image/webp' : 'image/jpeg');

    // Browser-only guard
    if (typeof window === 'undefined') {
      return { bytes: inputBytes, mime: inputMime };
    }

    const blob = new Blob([inputBytes], { type: inputMime || 'application/octet-stream' });

    const bitmap = await createBitmap(blob);
    if (!bitmap) {
      return { bytes: inputBytes, mime: inputMime };
    }

    const { width, height } = constrain(bitmap.width, bitmap.height, maxDim);
    const canvas = createCanvas(width, height);
    const ctx = (canvas as HTMLCanvasElement).getContext?.('2d') || (canvas as OffscreenCanvas).getContext('2d');
    if (!ctx) return { bytes: inputBytes, mime: inputMime };

    // Draw scaled
    (ctx as CanvasRenderingContext2D).drawImage(bitmap as any, 0, 0, width, height);

    const outBlob = await canvasToBlob(canvas, targetMime, quality);
    if (!outBlob) return { bytes: inputBytes, mime: inputMime };
    const ab = await outBlob.arrayBuffer();
    return { bytes: new Uint8Array(ab), mime: outBlob.type || targetMime };
  } catch {
    return { bytes: inputBytes, mime: inputMime };
  }
}

function constrain(w: number, h: number, maxDim: number): { width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

async function createBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement | null> {
  // Prefer createImageBitmap with EXIF orientation handling if supported
  try {
    if (typeof createImageBitmap === 'function') {
      // Some typings may not include imageOrientation; pass best-effort options
      return await (createImageBitmap as any)(blob, { imageOrientation: 'from-image' });
    }
  } catch {
    // fall through
  }
  // Fallback to HTMLImageElement
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality: number
): Promise<Blob | null> {
  if ('convertToBlob' in canvas && typeof (canvas as OffscreenCanvas).convertToBlob === 'function') {
    return (canvas as OffscreenCanvas).convertToBlob({ type, quality }).catch(() => null);
  }
  return new Promise((resolve) => {
    try {
      (canvas as HTMLCanvasElement).toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null);
    }
  });
}
