import * as THREE from "three";
import { AudioBus } from "../audio/AudioBus";
import {
  createEnemyRuntime,
  getClusterThreat,
  updateEnemyRuntime,
  applyPingAlert,
  type EnemyRuntime,
  type EnemyClusterRuntime,
} from "../ai/enemies";
import {
  WEAPON_RULES,
  createWeaponState,
  tryFireLaser,
  tryFireMissile,
  updateProjectiles,
  updateWeapons,
  type CombatEvent,
  type CombatTarget,
  type WeaponState,
} from "../combat/weapons";
import { createInitialState, type GameState } from "./state";
import { PLAYER } from "./constants";
import { computeCockpitCamera } from "../flight/cameraRig";
import { createMouseFlightState, updateMouseFlight, type MouseFlightState } from "../flight/flightControls";
import { buildStatusModel } from "../hud/statusModel";
import {
  createRadarState,
  getStrongestContact,
  updateRadarContacts,
  type RadarContact,
  type RadarState,
} from "../radar/radarModel";
import { createTargetLockState, updateTargetLock, type TargetLockState } from "../radar/targetLock";
import {
  createScanMemory,
  decayScanMemory,
  revealScanMemoryArea,
  revealScanMemoryWave,
  type ScanMemory,
} from "../radar/scanMemory";
import { createSonarPulse, triggerSonarPulse, updateSonarPulse, type SonarPulse } from "../radar/sonarPulse";
import { RendererApp } from "../render/RendererApp";
import { createTerrainVisuals, updateTerrainVisuals } from "../render/terrainVisuals";
import { createWorldVisuals } from "../render/worldVisuals";
import { createSector, type Sector } from "../terrain/sector";
import type { TerrainField } from "../terrain/TerrainField";

export type GameOptions = {
  seed?: number;
  terrain?: TerrainField;
};

export class Game {
  readonly state: GameState;

  private readonly audio = new AudioBus();
  private readonly enemyRuntime: EnemyRuntime;
  private readonly enemyTargets: RuntimeEnemyTarget[];
  private readonly enemyVisuals = new THREE.Group();
  private readonly markerByTargetId = new Map<string, THREE.Object3D>();
  private readonly host: HTMLElement;
  private readonly radar: RadarState;
  private readonly rendererApp: RendererApp;
  private readonly resizeHandler: () => void;
  private readonly keyDownHandler: (event: KeyboardEvent) => void;
  private readonly keyUpHandler: (event: KeyboardEvent) => void;
  private readonly mouseDownHandler: (event: MouseEvent) => void;
  private readonly mouseMoveHandler: (event: MouseEvent) => void;
  private readonly mouseUpHandler: (event: MouseEvent) => void;
  private readonly contextMenuHandler: (event: MouseEvent) => void;
  private readonly sector: Sector;
  private readonly terrainVisuals: THREE.Group;
  private readonly pressedKeys = new Set<string>();
  private readonly scanMemory: ScanMemory;
  private readonly scanMemoryTexture: THREE.DataTexture;
  private readonly sonar: SonarPulse;
  private readonly mouseFlight: MouseFlightState;
  private readonly targetLock: TargetLockState;
  private readonly weaponState: WeaponState;
  private readonly projectileVisuals = new THREE.Group();
  private readonly markerGeometry = new THREE.OctahedronGeometry(2.4, 0);
  private readonly scoutMaterial = new THREE.MeshBasicMaterial({ color: 0xff2800, wireframe: true, transparent: true, opacity: 0.88 });
  private readonly gunshipMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a00, wireframe: true, transparent: true, opacity: 0.94 });
  private readonly projectileGeometry = new THREE.SphereGeometry(1.25, 8, 6);
  private readonly projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.92 });
  private kills = 0;
  private animationFrame = 0;
  private disposed = false;
  private mouseAim = { x: 0, y: 0 };
  private pingRequested = false;
  private rightLockHeld = false;
  private started = false;
  private previousFrameTime = 0;

  constructor(host: HTMLElement, seedOrOptions?: number | GameOptions) {
    const options = typeof seedOrOptions === "number" ? { seed: seedOrOptions } : seedOrOptions ?? {};
    this.host = host;
    this.state = createInitialState(options.seed, options.terrain);
    this.sector = createSector(this.state.terrain, this.state.seed);
    this.enemyRuntime = createEnemyRuntime(this.sector, this.state.terrain);
    this.enemyTargets = createEnemyTargets(this.enemyRuntime);
    this.radar = createRadarState();
    this.sonar = createSonarPulse();
    this.mouseFlight = createMouseFlightState();
    this.targetLock = createTargetLockState();
    this.weaponState = createWeaponState();
    this.scanMemory = createScanMemory({ size: this.state.terrain.size });
    this.scanMemoryTexture = new THREE.DataTexture(
      this.scanMemory.values,
      this.scanMemory.resolution,
      this.scanMemory.resolution,
      THREE.RedFormat
    );
    this.scanMemoryTexture.magFilter = THREE.LinearFilter;
    this.scanMemoryTexture.minFilter = THREE.LinearFilter;
    this.scanMemoryTexture.unpackAlignment = 1;
    this.scanMemoryTexture.needsUpdate = true;
    this.rendererApp = new RendererApp(host);
    this.resizeHandler = () => this.rendererApp.resize();
    this.keyDownHandler = (event) => this.handleKeyDown(event);
    this.keyUpHandler = (event) => this.handleKeyUp(event);
    this.mouseMoveHandler = (event) => this.handleMouseMove(event);
    this.mouseDownHandler = (event) => this.handleMouseDown(event);
    this.mouseUpHandler = (event) => this.handleMouseUp(event);
    this.contextMenuHandler = (event) => event.preventDefault();
    this.terrainVisuals = createTerrainVisuals(this.state.terrain);
    this.enemyVisuals.name = "enemy-scan-markers";
    this.projectileVisuals.name = "weapon-projectile-markers";
    this.createEnemyMarkers();

    this.rendererApp.scene.add(createWorldVisuals(this.state.seed));
    this.rendererApp.scene.add(this.terrainVisuals);
    this.rendererApp.scene.add(this.enemyVisuals);
    this.rendererApp.scene.add(this.projectileVisuals);
  }

  start(): void {
    if (this.started || this.disposed) {
      return;
    }

    this.started = true;
    window.addEventListener("resize", this.resizeHandler);
    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
    this.host.addEventListener("mousemove", this.mouseMoveHandler);
    this.host.addEventListener("mousedown", this.mouseDownHandler);
    window.addEventListener("mouseup", this.mouseUpHandler);
    this.host.addEventListener("contextmenu", this.contextMenuHandler);
    this.resizeHandler();
    this.animationFrame = window.requestAnimationFrame(this.frame);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    window.removeEventListener("resize", this.resizeHandler);
    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup", this.keyUpHandler);
    this.host.removeEventListener("mousemove", this.mouseMoveHandler);
    this.host.removeEventListener("mousedown", this.mouseDownHandler);
    window.removeEventListener("mouseup", this.mouseUpHandler);
    this.host.removeEventListener("contextmenu", this.contextMenuHandler);
    window.cancelAnimationFrame(this.animationFrame);
    this.scanMemoryTexture.dispose();
    this.audio.dispose();
    this.markerGeometry.dispose();
    this.scoutMaterial.dispose();
    this.gunshipMaterial.dispose();
    this.projectileGeometry.dispose();
    this.projectileMaterial.dispose();
    this.rendererApp.dispose();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    this.pressedKeys.add(event.code);

    if (event.code === "Space" && !event.repeat) {
      event.preventDefault();
      triggerSonarPulse(this.sonar);
      this.pingRequested = true;
      this.audio.trigger("ping");
    }

    if ((event.code === "KeyF" || event.code === "ControlLeft") && !event.repeat) {
      event.preventDefault();
      this.fireLaser();
    }

    if (event.code === "KeyE" && !event.repeat) {
      event.preventDefault();
      this.fireMissile();
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.code);
  }

  private handleMouseMove(event: MouseEvent): void {
    const rect = this.host.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    this.mouseAim = {
      x: Math.max(-1, Math.min(1, (event.clientX - centerX) / Math.max(1, rect.width * 0.42))),
      y: Math.max(-1, Math.min(1, (event.clientY - centerY) / Math.max(1, rect.height * 0.42))),
    };
  }

  private handleMouseDown(event: MouseEvent): void {
    if (event.button === 2) {
      event.preventDefault();
      this.rightLockHeld = true;
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    if (event.button === 2) {
      event.preventDefault();
      this.rightLockHeld = false;
    }
  }

  private updatePlayer(deltaSeconds: number): void {
    const left = this.pressedKeys.has("ArrowLeft") || this.pressedKeys.has("KeyA");
    const right = this.pressedKeys.has("ArrowRight") || this.pressedKeys.has("KeyD");
    const throttle = this.pressedKeys.has("KeyW") ? 1 : this.pressedKeys.has("KeyS") ? 0.08 : 0.62;
    const boosting = this.pressedKeys.has("ShiftLeft") || this.pressedKeys.has("ShiftRight");
    const strafe = (right ? 1 : 0) - (left ? 1 : 0);

    updateMouseFlight(this.state.player, this.mouseFlight, this.state.terrain, {
      aimX: this.mouseAim.x,
      aimY: this.mouseAim.y,
      boost: boosting,
      deltaSeconds,
      strafe,
      throttle,
    });
    this.wrapPlayerToTerrain();
    if (this.rightLockHeld) {
      this.state.player.signature = Math.max(this.state.player.signature, 0.42);
    }
  }

  private wrapPlayerToTerrain(): void {
    const player = this.state.player;
    const halfSize = this.state.terrain.size * 0.44;

    if (player.position.x < -halfSize) player.position.x = halfSize;
    if (player.position.x > halfSize) player.position.x = -halfSize;
    if (player.position.z < -halfSize) player.position.z = halfSize;
    if (player.position.z > halfSize) player.position.z = -halfSize;
  }

  private updateCamera(): void {
    const rig = computeCockpitCamera(this.state.player);
    this.rendererApp.camera.position.set(rig.position.x, rig.position.y, rig.position.z);
    this.rendererApp.camera.lookAt(rig.target.x, rig.target.y, rig.target.z);
  }

  private updateInterface(): void {
    const activeContacts = this.activeRadarContacts();
    const strongest = getStrongestContact({ contacts: new Map(activeContacts.map((contact) => [contact.clusterId, contact])) });
    const threat = getClusterThreat(this.enemyRuntime);
    const activeTargets = this.enemyTargets.filter((target) => target.active !== false).length;
    const sectorCleared = 1 - activeTargets / Math.max(1, this.enemyTargets.length);
    const missileReady = 1 - this.weaponState.missileReloadRemaining / WEAPON_RULES.missile.reloadSeconds;
    const status = buildStatusModel({
      contactCount: activeContacts.length,
      strongestContact: strongest?.confidence ?? 0,
      threat: this.highestAlertLabel(),
      missile: missileReady,
      heat: this.state.player.heat / PLAYER.heatMax,
      sectorCleared,
    });

    this.host.style.setProperty("--sonar-reveal", this.sonar.reveal.toFixed(3));
    this.host.style.setProperty("--ship-heat", (this.state.player.heat / PLAYER.heatMax).toFixed(3));
    this.host.style.setProperty("--shield", (this.state.player.shield / PLAYER.shieldMax).toFixed(3));
    setText(this.host.querySelector(".activity-feed strong"), `${status.threatLabel} // ${status.contactText} // ${status.sectorText}`);
    setText(
      this.host.querySelector(".score-panel .session-live"),
      `${threat.activeClusters} SWARMS ACTIVE // ${status.missileText} // ${this.targetLock.status.toUpperCase()} ${Math.round(
        this.targetLock.quality * 100
      )}%`
    );
    const stats = this.host.querySelectorAll(".left-stats span");
    setText(stats[0], `KILLS ${this.kills}`);
    setText(stats[1], `CRED ${this.state.player.credits}`);
    setText(stats[2], status.heatText);
  }

  private createEnemyMarkers(): void {
    for (const target of this.enemyTargets) {
      const material = target.role === "gunship" ? this.gunshipMaterial : this.scoutMaterial;
      const marker = new THREE.Mesh(this.markerGeometry, material);
      marker.name = `enemy-marker-${target.id}`;
      marker.scale.setScalar(target.role === "gunship" ? 1.45 : 1);
      marker.position.set(target.position.x, target.position.y, target.position.z);
      this.markerByTargetId.set(target.id, marker);
      this.enemyVisuals.add(marker);
    }
  }

  private updateEnemyMarkers(): void {
    for (const target of this.enemyTargets) {
      const marker = this.markerByTargetId.get(target.id);
      if (!marker) {
        continue;
      }
      marker.visible = target.active !== false;
      marker.position.set(target.position.x, target.position.y, target.position.z);
      marker.rotation.y += 0.035 + (target.role === "gunship" ? 0.012 : 0.024);
      marker.rotation.x += 0.018;
    }
  }

  private updateEnemyTargets(deltaSeconds: number): void {
    for (const target of this.enemyTargets) {
      if (target.active === false || target.health <= 0) {
        continue;
      }

      const cluster = this.enemyRuntime.clusters.find((candidate) => candidate.id === target.clusterId);
      if (!cluster) {
        continue;
      }

      const alertRank = alertPressure(cluster.alert);
      const patrolOffset = target.role === "gunship" ? 18 : 28;
      const patrolAngle = this.state.time * (target.role === "gunship" ? 0.23 : 0.38) + target.id.length;
      const patrolTarget = {
        x: cluster.center.x + Math.cos(patrolAngle) * patrolOffset,
        z: cluster.center.z + Math.sin(patrolAngle) * patrolOffset,
      };
      const destination = alertRank >= 3 && cluster.lastKnownPosition ? cluster.lastKnownPosition : patrolTarget;
      const speed = target.role === "gunship" ? 12 : 22;
      const dx = destination.x - target.position.x;
      const dz = destination.z - target.position.z;
      const distance = Math.hypot(dx, dz);

      if (distance > 0.001) {
        const step = Math.min(distance, speed * (0.35 + alertRank * 0.12) * deltaSeconds);
        target.position.x += (dx / distance) * step;
        target.position.z += (dz / distance) * step;
      }

      target.position.y =
        this.state.terrain.heightAt(target.position.x, target.position.z) + (target.role === "gunship" ? 13 : 8);
    }
  }

  private updateProjectileMarkers(): void {
    const liveIds = new Set(this.weaponState.projectiles.map((projectile) => projectile.id));

    for (const child of [...this.projectileVisuals.children]) {
      if (!liveIds.has(child.name)) {
        this.projectileVisuals.remove(child);
      }
    }

    for (const projectile of this.weaponState.projectiles) {
      let marker = this.projectileVisuals.getObjectByName(projectile.id);
      if (!marker) {
        marker = new THREE.Mesh(this.projectileGeometry, this.projectileMaterial);
        marker.name = projectile.id;
        this.projectileVisuals.add(marker);
      }
      marker.position.set(projectile.position.x, projectile.position.y, projectile.position.z);
    }
  }

  private fireLaser(): void {
    const result = tryFireLaser(this.weaponState, this.state.player, this.activeTargets());
    if (result.ok) {
      this.audio.trigger("laser");
    }
    this.handleCombatEvents(result.events);
  }

  private fireMissile(): void {
    const target = this.targetLock.targetClusterId && this.targetLock.status === "locked"
      ? this.findTargetForCluster(this.targetLock.targetClusterId)
      : undefined;
    if (!target) {
      return;
    }

    const result = tryFireMissile(this.weaponState, this.state.player, this.targetLock.quality, target);
    if (result.ok) {
      this.audio.trigger("missile");
      this.markClusterAlert(target.clusterId, "confirmed");
    }
    this.handleCombatEvents(result.events);
  }

  private activeTargets(): RuntimeEnemyTarget[] {
    return this.enemyTargets.filter((target) => target.active !== false && target.health > 0);
  }

  private activeRadarContacts(): RadarContact[] {
    return [...this.radar.contacts.values()].filter((contact) => contact.source !== "ghost" && contact.confidence > 0.12);
  }

  private findTargetForCluster(clusterId: string): RuntimeEnemyTarget | undefined {
    const targets = this.activeTargets().filter((target) => target.clusterId === clusterId);
    targets.sort((a, b) => distance2D(a.position, this.state.player.position) - distance2D(b.position, this.state.player.position));
    return targets[0];
  }

  private handleCombatEvents(events: CombatEvent[]): void {
    for (const event of events) {
      if (event.type === "laser-hit" || event.type === "projectile-hit") {
        this.audio.trigger("hit");
        const target = this.enemyTargets.find((candidate) => candidate.id === event.targetId);
        if (target) {
          this.markClusterAlert(target.clusterId, "confirmed");
        }
      }

      if (event.type === "target-killed") {
        this.kills += 1;
        this.state.player.credits += 25;
        this.audio.trigger("kill");
        const target = this.enemyTargets.find((candidate) => candidate.id === event.targetId);
        if (target) {
          this.markClusterAlert(target.clusterId, this.clusterCleared(target.clusterId) ? "cooling" : "searching");
        }
      }
    }
  }

  private markClusterAlert(clusterId: string, alert: EnemyClusterRuntime["alert"]): void {
    const cluster = this.enemyRuntime.clusters.find((candidate) => candidate.id === clusterId);
    if (!cluster) {
      return;
    }
    cluster.alert = alert;
    cluster.confidence = Math.max(cluster.confidence, alert === "confirmed" ? 0.78 : 0.28);
    cluster.lastKnownPosition = { ...this.state.player.position };
  }

  private clusterCleared(clusterId: string): boolean {
    return this.enemyTargets.every((target) => target.clusterId !== clusterId || target.active === false || target.health <= 0);
  }

  private highestAlertLabel(): string {
    const order: EnemyClusterRuntime["alert"][] = [
      "attacking",
      "confirmed",
      "investigating",
      "searching",
      "suspicious",
      "cooling",
      "idle",
      "engaged",
    ];

    return order.find((alert) => this.enemyRuntime.clusters.some((cluster) => cluster.alert === alert)) ?? "idle";
  }

  private applyEnemyPressure(deltaSeconds: number): void {
    const threat = getClusterThreat(this.enemyRuntime);
    if (threat.level < 0.35) {
      return;
    }

    const cover = this.state.terrain.coverAt(
      this.state.player.position.x,
      this.state.player.position.z,
      this.state.player.position.y
    );
    const pressure = threat.level * (1 - cover * 0.72) * deltaSeconds;
    if (pressure <= 0) {
      return;
    }

    const shieldDamage = Math.min(this.state.player.shield, pressure * 5.6);
    this.state.player.shield -= shieldDamage;
    this.state.player.hull = Math.max(0, this.state.player.hull - Math.max(0, pressure * 2.2 - shieldDamage * 0.25));
  }

  private coolClearedClusters(): void {
    for (const cluster of this.enemyRuntime.clusters) {
      if (this.clusterCleared(cluster.id)) {
        cluster.alert = "cooling";
        cluster.confidence = 0;
      }
    }
  }

  private readonly frame = (time: number): void => {
    if (this.disposed) {
      return;
    }

    const deltaSeconds =
      this.previousFrameTime === 0 ? 0 : Math.min(0.05, (time - this.previousFrameTime) / 1000);
    this.previousFrameTime = time;
    this.state.time += deltaSeconds;
    this.updatePlayer(deltaSeconds);
    updateSonarPulse(this.sonar, deltaSeconds);
    updateWeapons(this.weaponState, deltaSeconds, [this.state.player]);
    decayScanMemory(this.scanMemory, deltaSeconds);
    revealScanMemoryArea(this.scanMemory, {
      origin: this.state.player.position,
      radius: 42,
      strength: 0.18,
    });
    if (this.sonar.reveal > 0) {
      revealScanMemoryWave(this.scanMemory, {
        origin: this.state.player.position,
        radius: this.sonar.radius,
        reveal: this.sonar.reveal,
        width: 22,
      });
    }
    if (this.pingRequested) {
      applyPingAlert(this.enemyRuntime, this.state.player.position, 170);
    }
    updateRadarContacts(this.radar, {
      player: this.state.player,
      clusters: this.enemyRuntime.clusters,
      terrain: this.state.terrain,
      deltaSeconds,
      ping: this.pingRequested,
      playerSignature: Math.max(this.state.player.signature, this.state.player.exposure),
    });
    updateTargetLock(this.targetLock, {
      contacts: [...this.radar.contacts.values()],
      deltaSeconds,
      requesting: this.rightLockHeld,
    });
    updateEnemyRuntime(this.enemyRuntime, {
      player: this.state.player,
      terrain: this.state.terrain,
      deltaSeconds,
      playerSignature: Math.max(this.state.player.signature, this.state.player.exposure),
    });
    this.updateEnemyTargets(deltaSeconds);
    this.handleCombatEvents(updateProjectiles(this.weaponState, this.enemyTargets, deltaSeconds));
    this.coolClearedClusters();
    this.applyEnemyPressure(deltaSeconds);
    this.pingRequested = false;
    if (this.scanMemory.dirty) {
      this.scanMemoryTexture.needsUpdate = true;
      this.scanMemory.dirty = false;
    }
    this.updateCamera();
    updateTerrainVisuals(this.terrainVisuals, {
      playerYaw: this.state.player.yaw,
      playerPosition: this.state.player.position,
      scanMemorySize: this.state.terrain.size,
      scanMemoryTexture: this.scanMemoryTexture,
      sonarRadius: this.sonar.radius,
      sonarReveal: this.sonar.reveal,
      time: this.state.time
    });
    this.updateEnemyMarkers();
    this.updateProjectileMarkers();
    this.updateInterface();

    this.rendererApp.render();
    this.animationFrame = window.requestAnimationFrame(this.frame);
  };
}

interface RuntimeEnemyTarget extends CombatTarget {
  active: boolean;
  clusterId: string;
  role: "scout" | "gunship";
}

function createEnemyTargets(runtime: EnemyRuntime): RuntimeEnemyTarget[] {
  return runtime.clusters.flatMap((cluster) =>
    cluster.units.map((unit) => ({
      id: unit.id,
      active: true,
      clusterId: cluster.id,
      health: unit.role === "gunship" ? 90 : 44,
      position: unit.position,
      role: unit.role,
    }))
  );
}

function distance2D(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function setText(element: Element | undefined | null, text: string): void {
  if (element) {
    element.textContent = text;
  }
}

function alertPressure(alert: EnemyClusterRuntime["alert"]): number {
  switch (alert) {
    case "attacking":
    case "engaged":
      return 5;
    case "confirmed":
      return 4;
    case "investigating":
      return 3;
    case "searching":
      return 2;
    case "suspicious":
      return 1;
    case "cooling":
    case "idle":
      return 0;
  }
}
