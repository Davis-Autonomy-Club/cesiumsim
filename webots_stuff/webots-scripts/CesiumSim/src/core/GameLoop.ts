import * as Cesium from 'cesium';
import { Scene } from './Scene';

export interface Updatable {
  update(deltaTime: number): void;
}

export class GameLoop {
  private scene: Scene;
  private updatables: Updatable[] = [];
  private lastTime: number = 0;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public addUpdatable(item: Updatable) {
    this.updatables.push(item);
  }

  public start() {
    this.scene.viewer.scene.preUpdate.addEventListener((_scene, time) => {
      const now = Cesium.JulianDate.toDate(time).getTime();
      if (this.lastTime === 0) {
        this.lastTime = now;
        return;
      }

      const deltaTime = (now - this.lastTime) / 1000; // Seconds
      this.lastTime = now;

      this.update(deltaTime);
    });
  }

  private update(deltaTime: number) {
    // Cap simulation step to prevent physics explosions on lag
    const dt = Math.min(deltaTime, 0.1);
    
    for (const item of this.updatables) {
      item.update(dt);
    }
  }
}

