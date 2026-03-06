interface ImportMetaEnv {
  readonly VITE_CESIUM_TOKEN: string;
  readonly VITE_GEMINI_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const Cesium: any;

interface Window {
  Cesium?: any;
}

declare module "@takram/three-atmosphere";
declare module "@takram/three-geospatial";
declare module "@takram/three-geospatial-effects";
declare module "@takram/three-clouds";
