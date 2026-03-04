import { Scene } from './core/Scene';
import { GameLoop } from './core/GameLoop';
import { DroneViewer } from './vehicles/DroneViewer';
import { SpringArmCamera } from './camera/SpringArmCamera';
import * as Cesium from 'cesium';

// Cesium CSS for proper widget rendering
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Setup Token BEFORE any Cesium API calls
// @ts-ignore
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

/**
 * 3D Drone Viewer
 * 
 * Clean visualization of a drone model on Google 3D Tiles
 * Camera controls: Right-drag orbit, scroll zoom, R reset
 */

async function bootstrap() {
  console.log('='.repeat(60));
  console.log('  3D Drone Viewer');
  console.log('='.repeat(60));

  // Validate Cesium token
  if (!Cesium.Ion.defaultAccessToken || Cesium.Ion.defaultAccessToken === 'undefined') {
    console.error('[ERROR] VITE_CESIUM_TOKEN not set!');
    document.body.innerHTML = `
      <div style="color: red; padding: 20px; font-family: Helvetica, Arial, sans-serif;">
        <h2>Cesium Token Missing</h2>
        <p>Create a <code>.env.local</code> file with:</p>
        <pre>VITE_CESIUM_TOKEN=your_token_here</pre>
        <p>Get a token at: <a href="https://cesium.com/ion/tokens" target="_blank">cesium.com/ion/tokens</a></p>
      </div>
    `;
    return;
  }

  // Initialize scene with 3D tiles
  const scene = await Scene.create('cesiumContainer');
  const loop = new GameLoop(scene);

  // Davis, CA starting position at 100m altitude
  const startPos = Cesium.Cartesian3.fromDegrees(-121.7520, 38.5422, 100);

  // Create drone viewer
  const drone = new DroneViewer(scene, startPos);
  loop.addUpdatable(drone);
  
  console.log('[OK] Drone model loaded');

  // Setup Spring Arm Camera for orbit/zoom controls
  const camera = new SpringArmCamera(scene, drone);
  loop.addUpdatable(camera);

  // Start render loop
  loop.start();
  
  console.log('='.repeat(60));
  console.log('  [OK] Viewer Ready');
  console.log('='.repeat(60));
  console.log('');
  console.log('  Camera Controls:');
  console.log('     Right-drag  - Orbit camera');
  console.log('     Scroll      - Zoom in/out');
  console.log('     R           - Reset camera');
  console.log('     +/-         - Zoom keys');
  console.log('     [/]         - Orbit keys');
  console.log('');
  console.log('='.repeat(60));
}

bootstrap().catch((err) => {
  console.error('[ERROR] Bootstrap failed:', err);
});
