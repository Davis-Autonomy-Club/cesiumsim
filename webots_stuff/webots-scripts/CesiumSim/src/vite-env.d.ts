/// <reference types="vite/client" />

/**
 * Type declarations for Vite environment variables.
 * These are accessed via import.meta.env.VITE_*
 */
interface ImportMetaEnv {
  /** Cesium Ion API Token for terrain, imagery, and 3D tiles */
  readonly VITE_CESIUM_TOKEN: string;
  
  /** Google Maps API Key for Photorealistic 3D Tiles */
  readonly VITE_GOOGLE_MAPS_KEY?: string;
  
  /** Mapbox Token for satellite imagery (optional) */
  readonly VITE_MAPBOX_TOKEN?: string;
  
  /** Vite mode (development, production) */
  readonly MODE: string;
  
  /** Base URL */
  readonly BASE_URL: string;
  
  /** Is production build */
  readonly PROD: boolean;
  
  /** Is development mode */
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
