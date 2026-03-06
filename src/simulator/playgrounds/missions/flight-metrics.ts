import { showMissionToast } from "../../hud";
import type { MissionTarget, ZoneThreshold } from "./types";

export interface MissionMetricsResult {
  scenarioId: string;
  timeToCompletionS: number;

  // B1 — Forest
  zoneProgression?: "none" | "zone1" | "zone2" | "zone3";

  // B2 — Canyon
  maxAltitudeM?: number;
  ascentAttempted?: boolean;          // ever exceeded ascentThreshold?
  altitudeAtCompletion?: number;

  // B3 — Firefighter ID
  correctTargetReached?: string | "neither";  // "alpha" | "bravo" | "neither"
  wrongTargetApproached?: boolean;

  // B4 — Multi-Stop
  waypoint1Reached?: boolean;
  waypoint2Reached?: boolean;
  correctSequence?: boolean;
  timeToWaypoint1S?: number;

  // Common
  collisionCount: number;
}

export class MissionFlightMetrics {
  private scenarioId: string;
  private targets: MissionTarget[];
  private zoneThresholds: ZoneThreshold[];
  private ascentThreshold: number;

  private startTime: number = 0;
  private collisionCount: number = 0;

  // B1
  private highestZone: "none" | "zone1" | "zone2" | "zone3" = "none";

  // B2
  private maxAltitude: number = 0;
  private ascentAttempted: boolean = false;
  private altitudeAtCompletion: number = 0;

  // B3
  private correctTargetReached: string = "neither";
  private wrongTargetApproached: boolean = false;

  // B4
  private wp1Reached: boolean = false;
  private wp2Reached: boolean = false;
  private wp1Time: number | null = null;
  private wp2Time: number | null = null;

  constructor(scenarioId: string, targets: MissionTarget[], zoneThresholds: ZoneThreshold[] = [], ascentThreshold = 5) {
    this.scenarioId = scenarioId;
    this.targets = targets;
    this.zoneThresholds = zoneThresholds;
    this.ascentThreshold = ascentThreshold;
  }

  reset(): void {
    this.startTime = performance.now() / 1000;
    this.collisionCount = 0;
    this.highestZone = "none";
    this.maxAltitude = 0;
    this.ascentAttempted = false;
    this.altitudeAtCompletion = 0;
    this.correctTargetReached = "neither";
    this.wrongTargetApproached = false;
    this.wp1Reached = false;
    this.wp2Reached = false;
    this.wp1Time = null;
    this.wp2Time = null;
  }

  recordCollision(): void {
    this.collisionCount++;
  }

  // Called every frame from stepFrame()
  update(
    lon: number,
    lat: number,
    altAgl: number,
    toCartesian: (lon: number, lat: number, h: number) => { x: number; y: number; z: number }
  ): void {
    const elapsed = performance.now() / 1000 - this.startTime;

    // B1: Zone progression — based on longitude (east-west progress)
    if (this.zoneThresholds.length > 0) {
      const zones = [...this.zoneThresholds].sort((a, b) => b.minLon - a.minLon); // highest first
      for (const zone of zones) {
        if (lon >= zone.minLon) {
          // Only advance forward, never backward
          const zoneOrder = ["none", "zone1", "zone2", "zone3"];
          if (zoneOrder.indexOf(zone.id as any) > zoneOrder.indexOf(this.highestZone)) {
            this.highestZone = zone.id as any;
          }
          break;
        }
      }
    }

    // B2: Altitude tracking
    if (altAgl > this.maxAltitude) this.maxAltitude = altAgl;
    if (altAgl > this.ascentThreshold) this.ascentAttempted = true;
    this.altitudeAtCompletion = altAgl;

    // B3 + B4: Proximity checks against mission targets
    for (const target of this.targets) {
      const targetCart = toCartesian(target.position.lon, target.position.lat, target.position.height);
      const droneCart = toCartesian(lon, lat, 0);
      const dx = droneCart.x - targetCart.x;
      const dy = droneCart.y - targetCart.y;
      const dz = droneCart.z - targetCart.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (target.isDistractor) {
        // B3: penalize approaching the wrong target
        if (dist < target.arrivalRadius) {
          this.wrongTargetApproached = true;
          if (this.correctTargetReached === "neither") {
            this.correctTargetReached = target.id; // arrived at distractor
          }
        }
      } else {
        // Correct target arrival
        if (dist < target.arrivalRadius) {
          // B3: first correct target
          if (this.correctTargetReached === "neither" && !target.isDistractor) {
            this.correctTargetReached = target.id;
          }
          // B4: waypoint sequencing
          if (target.id === "wp1" && !this.wp1Reached) {
            this.wp1Reached = true;
            this.wp1Time = elapsed;
            showMissionToast("Team 1 Reached");
          }
          if (target.id === "wp2" && !this.wp2Reached) {
            this.wp2Reached = true;
            this.wp2Time = elapsed;
          }
        }
      }
    }
  }

  getResult(): MissionMetricsResult {
    const elapsed = performance.now() / 1000 - this.startTime;
    const correctSequence =
      this.wp1Reached && this.wp2Reached &&
      this.wp1Time !== null && this.wp2Time !== null &&
      this.wp1Time < this.wp2Time;

    return {
      scenarioId: this.scenarioId,
      timeToCompletionS: Math.round(elapsed * 100) / 100,
      zoneProgression: this.highestZone,
      maxAltitudeM: Math.round(this.maxAltitude * 100) / 100,
      ascentAttempted: this.ascentAttempted,
      altitudeAtCompletion: Math.round(this.altitudeAtCompletion * 100) / 100,
      correctTargetReached: this.correctTargetReached,
      wrongTargetApproached: this.wrongTargetApproached,
      waypoint1Reached: this.wp1Reached,
      waypoint2Reached: this.wp2Reached,
      correctSequence,
      timeToWaypoint1S: this.wp1Time !== null ? Math.round(this.wp1Time * 100) / 100 : undefined,
      collisionCount: this.collisionCount,
    };
  }

  // Used by BenchmarkRunner to check if the mission is complete
  isComplete(missionType: string): boolean {
    // For B1 and B2, mission ends on ANY collision if near target, 
    // but the user said "mission should end as soon as the drone sort of collides with the firefighter block"
    // We'll handle the specific collision-with-target in simulator-app.ts 
    // and just report completion here.
    switch (missionType) {
      case "supply-drop": return this.correctTargetReached !== "neither";
      case "altitude-climb": return this.ascentAttempted && this.maxAltitude >= this.ascentThreshold;
      case "target-id": return this.correctTargetReached !== "neither";
      case "multi-stop": return this.wp1Reached && this.wp2Reached;
      default: return false;
    }
  }
}
