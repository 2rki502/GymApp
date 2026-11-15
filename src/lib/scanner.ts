/**
 * Camera barcode / QR scanner.
 *
 * iPhone Safari has no built-in BarcodeDetector, so detection uses the `barcode-detector` ponyfill
 * (zxing-wasm). It is imported only when the scanner opens, and its WebAssembly file is served
 * from this site (not a third-party CDN), so the app stays small and self-contained.
 */

export type ScanError =
  | 'insecure' // camera APIs need https (the LAN http:// address can't use the camera)
  | 'unsupported' // no camera API in this browser
  | 'denied' // permission refused
  | 'noCamera' // no suitable camera
  | 'inUse' // camera busy in another app
  | 'cancelled' // the screen closed or restarted the scanner before it was ready
  | 'failed';

export class ScannerError extends Error {
  constructor(public reason: ScanError) {
    super(reason);
  }
}

/** Formats on food packaging: retail barcodes, plus QR (GS1 Digital Link). */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'] as const;

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string; format: string }[]> };

let detectorPromise: Promise<Detector> | null = null;

function loadDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
      import('barcode-detector/ponyfill'),
      import('zxing-wasm/reader/zxing_reader.wasm?url'),
    ]);
    prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
    });
    return new BarcodeDetector({ formats: [...FORMATS] }) as unknown as Detector;
  })().catch((e) => {
    detectorPromise = null; // allow a retry
    throw e;
  });
  return detectorPromise;
}

function cameraError(e: unknown): ScanError {
  const name = (e as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'noCamera';
  if (name === 'NotReadableError' || name === 'AbortError') return 'inUse';
  return 'failed';
}

export interface Scanner {
  stop: () => void;
}

/**
 * Start the back camera in `video` and call `onCode` once a code has been read twice in a row
 * (a cheap guard against a one-frame misread). Rejects with a ScannerError.
 *
 * `signal` cancels a start that is no longer wanted (the screen closed, or a restart began):
 * the abandoned attempt releases its camera and never touches `video` again, so two
 * overlapping starts can't knock each other out.
 */
export async function startScanner(
  video: HTMLVideoElement,
  onCode: (raw: string, format: string) => void,
  signal?: AbortSignal,
): Promise<Scanner> {
  if (typeof window !== 'undefined' && !window.isSecureContext) throw new ScannerError('insecure');
  if (!navigator.mediaDevices?.getUserMedia) throw new ScannerError('unsupported');

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch (e) {
    throw new ScannerError(cameraError(e));
  }

  let stopped = false;
  let timer = 0;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    // Only detach our own stream: a newer start may already own this element.
    if (video.srcObject === stream) video.srcObject = null;
  };
  const cancelled = () => {
    if (!signal?.aborted) return false;
    stop();
    return true;
  };
  if (cancelled()) throw new ScannerError('cancelled');

  try {
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
  } catch (e) {
    const superseded = signal?.aborted || video.srcObject !== stream;
    stop();
    throw new ScannerError(superseded ? 'cancelled' : cameraError(e));
  }
  if (cancelled()) throw new ScannerError('cancelled');

  let detector: Detector;
  try {
    detector = await loadDetector();
  } catch {
    stop();
    throw new ScannerError('failed');
  }
  if (cancelled()) throw new ScannerError('cancelled');

  let last = '';
  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2) {
        const codes = await detector.detect(video);
        const hit = codes[0];
        if (hit && !stopped) {
          if (hit.rawValue === last) {
            stopped = true;
            onCode(hit.rawValue, hit.format);
            return;
          }
          last = hit.rawValue;
        } else last = '';
      }
    } catch {
      // A frame that can't be read is normal; keep scanning.
    }
    if (!stopped) timer = window.setTimeout(tick, 180);
  };
  void tick();
  return { stop };
}

/** Warm up the detector (download + compile) while the camera permission prompt is showing. */
export function preloadScanner() {
  void loadDetector().catch(() => undefined);
}
