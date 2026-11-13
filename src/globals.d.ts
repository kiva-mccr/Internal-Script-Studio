// Set by vite.config.ts at build time: the live version (AP-28), or null.
declare const __VERSION__: import('./lib/version').Version | null;

// UTIF (TIFF reader for previews, AP-19) ships without types: only what lib/preview.ts uses.
declare module 'utif' {
  type Page = { width: number; height: number };
  const UTIF: {
    decode(buffer: ArrayBuffer): Page[];
    decodeImage(buffer: ArrayBuffer, page: Page): void;
    toRGBA8(page: Page): Uint8Array;
  };
  export default UTIF;
}
