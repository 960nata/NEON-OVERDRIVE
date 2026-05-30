// 3D Synthwave Tunnel Racer Game Engine using raw Three.js
import * as THREE from 'three';
import { audioManager } from './AudioManager';

export interface GameEngineCallbacks {
  onScoreChange: (score: number) => void;
  onHealthChange: (health: number) => void;
  onGameOver: (finalScore: number) => void;
  onSpeedChange: (speed: number) => void;
}

interface Obstacle {
  mesh: THREE.Group;
  angle: number;
  zSpeed: number;
  type: 'cube' | 'pyramid' | 'barrier';
  passed: boolean;
}

interface Laser {
  mesh: THREE.Mesh;
  angle: number;
  z: number;
  zSpeed: number;
  isEnemy: boolean;
}

interface Enemy {
  mesh: THREE.Group;
  angle: number;
  z: number;
  zSpeed: number;
  health: number;
  shootTimer: number;
  shootInterval: number;
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  maxLife: number;
  life: number;
  mesh: THREE.Mesh;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private callbacks: GameEngineCallbacks;

  // Three.js Core
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock!: THREE.Clock;
  private animationFrameId: number | null = null;

  // Game Settings & Constants
  private readonly TUNNEL_RADIUS = 10;
  private readonly TUNNEL_LENGTH = 100;
  private readonly SHIP_Z = -18;
  private readonly SPAWN_Z = -220;
  private readonly DESPAWN_Z = 15;

  // Game State
  private score = 0;
  private health = 3;
  private baseSpeed = 50;
  private speedMultiplier = 1.0;
  private isRunning = false;
  private isGameplayActive = false;
  private playerAngle = 0;
  private targetPlayerAngle = 0;
  private keyState: { [key: string]: boolean } = {};
  private lastPlayerFireTime = 0;
  private readonly FIRE_COOLDOWN = 0.22;
  private selectedShipType: 'f15' | 'f22' | 'su57' = 'f15';
  
  // Game Objects
  private playerShip!: THREE.Group;
  private tunnelSegments: THREE.Group[] = [];
  private obstacles: Obstacle[] = [];
  private enemies: Enemy[] = [];
  private lasers: Laser[] = [];
  private starfield!: THREE.Points;
  private starGeometry!: THREE.BufferGeometry;
  private starPositions!: Float32Array;
  private starSpeeds!: Float32Array;
  private explosionParticles: Particle[] = [];

  // Visual Effects
  private shakeIntensity = 0;
  private shakeDecay = 0.9;
  private originalCameraPos = new THREE.Vector3(0, 0, 4);
  private glitchActive = false;
  private glitchTimer = 0;

  // Spawning
  private obstacleSpawnTimer = 0;
  private spawnInterval = 1.6;

  // Input state
  private isPointerDown = false;
  private lastPointerX = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: GameEngineCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.initThree();
    this.createTunnel();
    this.createPlayerShip();
    this.createStarfield();
    this.setupLights();
    this.setupInput();
    
    this.callbacks.onHealthChange(this.health);
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onSpeedChange(Math.round(this.baseSpeed * this.speedMultiplier));
  }

  private initThree() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050110, 0.007);

    const aspect = width / height;
    // Increase Field of View (FOV) on portrait/mobile screens so elements don't appear zoomed in too close
    const initialFov = aspect < 1 ? 65 + (1 - aspect) * 22 : 65;
    this.camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.1, 300);
    this.camera.position.set(0, 0, 4);
    this.originalCameraPos.copy(this.camera.position);

    this.clock = new THREE.Clock();
  }

  private setupLights() {
    const ambientLight = new THREE.AmbientLight(0xff00ff, 0.4);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f0ff, 0.8);
    dirLight.position.set(0, 5, -10);
    this.scene.add(dirLight);

    // Dynamic light tracking the ship
    const shipLight = new THREE.PointLight(0x00f0ff, 3, 25);
    shipLight.position.set(0, 0, -2);
    this.playerShip.add(shipLight);
  }

  private createTunnel() {
    const segmentCount = 3;
    const colors = [0x7000ff, 0x00f0ff, 0xff00ff];

    for (let i = 0; i < segmentCount; i++) {
      const segmentGroup = new THREE.Group();
      
      const cylGeo = new THREE.CylinderGeometry(
        this.TUNNEL_RADIUS,
        this.TUNNEL_RADIUS,
        this.TUNNEL_LENGTH,
        24,
        20,
        true
      );
      cylGeo.rotateX(Math.PI / 2);

      const outerMat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        wireframe: true,
        transparent: true,
        opacity: 0.25,
        side: THREE.BackSide,
      });
      const outerMesh = new THREE.Mesh(cylGeo, outerMat);
      segmentGroup.add(outerMesh);

      const ringGeo = new THREE.TorusGeometry(this.TUNNEL_RADIUS - 0.05, 0.05, 8, 36);
      for (let r = -this.TUNNEL_LENGTH / 2; r <= this.TUNNEL_LENGTH / 2; r += 10) {
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0.4,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.set(0, 0, r);
        segmentGroup.add(ringMesh);
      }

      segmentGroup.position.z = -i * this.TUNNEL_LENGTH;
      this.scene.add(segmentGroup);
      this.tunnelSegments.push(segmentGroup);
    }
  }

  private createPlayerShip() {
    this.playerShip = new THREE.Group();
    this.rebuildPlayerShip();
    this.updatePlayerShipPosition();
    this.scene.add(this.playerShip);
  }

  private createEnemyMesh(color: number): THREE.Group {
    const group = new THREE.Group();

    // Fuselage pointing forward (towards positive Z, i.e., at player)
    const bodyGeo = new THREE.ConeGeometry(0.45, 1.8, 4);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.2,
      metalness: 0.8,
      flatShading: true,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(bodyMesh);

    const wireGeo = new THREE.EdgesGeometry(bodyGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 2 });
    const wire = new THREE.LineSegments(wireGeo, wireMat);
    group.add(wire);

    // Wings extending outward
    const wingGeo = new THREE.ConeGeometry(0.25, 1.0, 3);
    wingGeo.rotateZ(-Math.PI / 3);
    wingGeo.rotateX(Math.PI / 2);
    
    const leftWing = new THREE.Mesh(wingGeo, bodyMat);
    leftWing.position.set(-0.6, -0.15, -0.2);
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, bodyMat);
    rightWing.position.copy(leftWing.position);
    rightWing.position.x = 0.6;
    rightWing.rotation.z = Math.PI / 3;
    group.add(rightWing);

    return group;
  }

  public setShipType(type: 'f15' | 'f22' | 'su57') {
    this.selectedShipType = type;
    this.rebuildPlayerShip();
  }

  private rebuildPlayerShip() {
    // 1. Dispose and remove all children of the playerShip
    while (this.playerShip.children.length > 0) {
      const child = this.playerShip.children[0];
      this.playerShip.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    // 2. Select theme color based on jet type
    let shipColor = 0x00f0ff; // F-15: Cyan
    if (this.selectedShipType === 'f22') shipColor = 0xff00ff; // F-22: Pink
    if (this.selectedShipType === 'su57') shipColor = 0xffff00; // Su-57: Yellow/Gold

    const bodyMat = new THREE.MeshStandardMaterial({
      color: shipColor,
      roughness: 0.15,
      metalness: 0.85,
      flatShading: true,
    });

    const wireMat = new THREE.LineBasicMaterial({
      color: shipColor,
      linewidth: 2,
    });

    // Helper to build model parts with their wireframe edges
    const addPart = (geo: THREE.BufferGeometry, pos: THREE.Vector3, rot: THREE.Euler = new THREE.Euler()) => {
      const mesh = new THREE.Mesh(geo, bodyMat);
      mesh.position.copy(pos);
      mesh.rotation.copy(rot);
      this.playerShip.add(mesh);

      const wireGeo = new THREE.EdgesGeometry(geo);
      const wire = new THREE.LineSegments(wireGeo, wireMat);
      wire.position.copy(pos);
      wire.rotation.copy(rot);
      this.playerShip.add(wire);
    };

    if (this.selectedShipType === 'f15') {
      // F-15 Eagle Geometries
      const fuseGeo = new THREE.CylinderGeometry(0.18, 0.22, 2.3, 6);
      fuseGeo.rotateX(Math.PI / 2);
      addPart(fuseGeo, new THREE.Vector3(0, 0, 0));

      const noseGeo = new THREE.ConeGeometry(0.18, 0.8, 6);
      noseGeo.rotateX(-Math.PI / 2);
      addPart(noseGeo, new THREE.Vector3(0, 0, -1.55));

      // Wing profile
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(-1.3, 0.8);
      wingShape.lineTo(-1.3, 0.2);
      wingShape.lineTo(-0.25, -0.6);
      wingShape.lineTo(0, -0.6);
      
      const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.04, bevelEnabled: false });
      wingGeo.rotateX(Math.PI / 2);
      wingGeo.translate(0, 0, 0.4);
      addPart(wingGeo, new THREE.Vector3(0, -0.05, -0.4));

      const wingRightGeo = wingGeo.clone().scale(-1, 1, 1);
      addPart(wingRightGeo, new THREE.Vector3(0, -0.05, -0.4));

      // Twins vertical tails
      const tailGeo = new THREE.BoxGeometry(0.04, 0.75, 0.45);
      addPart(tailGeo, new THREE.Vector3(-0.25, 0.38, 0.8));
      addPart(tailGeo, new THREE.Vector3(0.25, 0.38, 0.8));

      // Horizontal rear stabilizers
      const stabGeo = new THREE.BoxGeometry(0.55, 0.03, 0.35);
      addPart(stabGeo, new THREE.Vector3(-0.55, -0.05, 0.95));
      addPart(stabGeo, new THREE.Vector3(0.55, -0.05, 0.95));

    } else if (this.selectedShipType === 'f22') {
      // F-22 Raptor Geometries
      const fuseGeo = new THREE.CylinderGeometry(0.28, 0.32, 2.0, 4);
      fuseGeo.rotateX(Math.PI / 2);
      fuseGeo.scale(1.5, 0.65, 1.0);
      addPart(fuseGeo, new THREE.Vector3(0, 0, 0));

      const noseGeo = new THREE.ConeGeometry(0.28, 0.8, 4);
      noseGeo.rotateX(-Math.PI / 2);
      noseGeo.scale(1.5, 0.65, 1.0);
      addPart(noseGeo, new THREE.Vector3(0, 0, -1.4));

      // Stealth angled wings
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(-1.45, 0.4);
      wingShape.lineTo(-1.15, -0.4);
      wingShape.lineTo(-0.25, -0.55);
      wingShape.lineTo(0, -0.55);

      const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.04, bevelEnabled: false });
      wingGeo.rotateX(Math.PI / 2);
      wingGeo.translate(0, 0, 0.3);
      addPart(wingGeo, new THREE.Vector3(0, -0.04, -0.3));

      const wingRightGeo = wingGeo.clone().scale(-1, 1, 1);
      addPart(wingRightGeo, new THREE.Vector3(0, -0.04, -0.3));

      // Canted twin vertical stabilizers
      const tailGeo = new THREE.BoxGeometry(0.04, 0.7, 0.42);
      addPart(tailGeo, new THREE.Vector3(-0.35, 0.38, 0.7), new THREE.Euler(0, 0, -0.22));
      addPart(tailGeo, new THREE.Vector3(0.35, 0.38, 0.7), new THREE.Euler(0, 0, 0.22));

      // Horizontal stabilizers
      const stabGeo = new THREE.BoxGeometry(0.5, 0.03, 0.35);
      addPart(stabGeo, new THREE.Vector3(-0.6, -0.05, 0.85));
      addPart(stabGeo, new THREE.Vector3(0.6, -0.05, 0.85));

    } else {
      // Su-57 Felon Geometries
      const fuseGeo = new THREE.CylinderGeometry(0.38, 0.42, 2.1, 8);
      fuseGeo.rotateX(Math.PI / 2);
      fuseGeo.scale(2.1, 0.5, 1.0);
      addPart(fuseGeo, new THREE.Vector3(0, 0, 0));

      const noseGeo = new THREE.ConeGeometry(0.38, 0.7, 4);
      noseGeo.rotateX(-Math.PI / 2);
      noseGeo.scale(2.1, 0.5, 1.0);
      addPart(noseGeo, new THREE.Vector3(0, 0, -1.4));

      // Wide delta wings
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(-1.6, 0.6);
      wingShape.lineTo(-1.4, -0.25);
      wingShape.lineTo(-0.3, -0.5);
      wingShape.lineTo(0, -0.5);

      const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.035, bevelEnabled: false });
      wingGeo.rotateX(Math.PI / 2);
      wingGeo.translate(0, 0, 0.35);
      addPart(wingGeo, new THREE.Vector3(0, -0.02, -0.35));

      const wingRightGeo = wingGeo.clone().scale(-1, 1, 1);
      addPart(wingRightGeo, new THREE.Vector3(0, -0.02, -0.35));

      // Short heavily canted twin tails
      const tailGeo = new THREE.BoxGeometry(0.04, 0.52, 0.38);
      addPart(tailGeo, new THREE.Vector3(-0.45, 0.28, 0.75), new THREE.Euler(0, 0, -0.35));
      addPart(tailGeo, new THREE.Vector3(0.45, 0.28, 0.75), new THREE.Euler(0, 0, 0.35));
    }

    // 3. Engine flame (neon pink)
    const flameGeo = new THREE.ConeGeometry(0.25, 0.8, 4);
    flameGeo.rotateX(Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      transparent: true,
      opacity: 0.8,
    });
    const flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.position.set(0, -0.1, 1.25);
    flameMesh.name = 'engineFlame';
    this.playerShip.add(flameMesh);

    // 4. Add dynamic light matching ship's laser color
    const shipLight = new THREE.PointLight(shipColor, 3, 25);
    shipLight.position.set(0, 0, -2);
    this.playerShip.add(shipLight);
  }

  private createStarfield() {
    const starCount = 300;
    this.starGeometry = new THREE.BufferGeometry();
    this.starPositions = new Float32Array(starCount * 3);
    this.starSpeeds = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const r = this.TUNNEL_RADIUS + Math.random() * 30;
      const angle = Math.random() * Math.PI * 2;
      const x = r * Math.sin(angle);
      const y = r * Math.cos(angle);
      const z = Math.random() * -300;

      this.starPositions[i * 3] = x;
      this.starPositions[i * 3 + 1] = y;
      this.starPositions[i * 3 + 2] = z;

      this.starSpeeds[i] = 1.0 + Math.random() * 1.5;
    }

    this.starGeometry.setAttribute('position', new THREE.BufferAttribute(this.starPositions, 3));

    const starMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.25,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    this.starfield = new THREE.Points(this.starGeometry, starMat);
    this.scene.add(this.starfield);
  }

  private updatePlayerShipPosition() {
    const placementRadius = this.TUNNEL_RADIUS - 0.7;
    
    this.playerShip.position.x = placementRadius * Math.sin(this.playerAngle);
    this.playerShip.position.y = placementRadius * Math.cos(this.playerAngle);
    this.playerShip.position.z = this.SHIP_Z;

    this.playerShip.rotation.z = -this.playerAngle;
    
    let angleDiff = this.targetPlayerAngle - this.playerAngle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    
    this.playerShip.rotation.y = THREE.MathUtils.clamp(angleDiff * 3, -0.4, 0.4);
  }

  private setupInput() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
    
    // Prevent default touch interactions to block page scrolling and pull-to-refresh gestures during play
    this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  private cleanupInput() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    this.keyState[e.code] = true;
    
    if (e.code === 'Space' && this.isRunning && this.isGameplayActive) {
      this.shootPlayerLaser();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keyState[e.code] = false;
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.isPointerDown = true;
    this.lastPointerX = e.clientX;
    audioManager.resume();

    // Tap to shoot on click/touch
    if (this.isRunning && this.isGameplayActive) {
      this.shootPlayerLaser();
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isPointerDown || !this.isRunning || !this.isGameplayActive) return;
    
    const deltaX = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;

    const dragSensitivity = 0.007;
    this.targetPlayerAngle += deltaX * dragSensitivity;
  };

  private handlePointerUp = () => {
    this.isPointerDown = false;
  };

  private handleWindowBlur = () => {
    // Clear key states and drag flags when window loses focus to prevent stuck keys/moves
    this.keyState = {};
    this.isPointerDown = false;
  };

  // --- Combat Mechanics & Shooting ---

  private shootPlayerLaser() {
    const now = this.clock.getElapsedTime();
    if (now - this.lastPlayerFireTime < this.FIRE_COOLDOWN) return;
    this.lastPlayerFireTime = now;

    // Trigger audio & visual flash
    audioManager.playLaser();
    this.triggerFlashEffect();

    const placementRadius = this.TUNNEL_RADIUS - 0.7;
    const x = placementRadius * Math.sin(this.playerAngle);
    const y = placementRadius * Math.cos(this.playerAngle);
    const z = this.SHIP_Z - 1.2;

    let laserColor = 0x00f0ff;
    if (this.selectedShipType === 'f22') laserColor = 0xff00ff;
    if (this.selectedShipType === 'su57') laserColor = 0xffff00;

    const laserGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 4);
    laserGeo.rotateX(Math.PI / 2);
    const laserMat = new THREE.MeshBasicMaterial({ color: laserColor });
    const laserMesh = new THREE.Mesh(laserGeo, laserMat);
    laserMesh.position.set(x, y, z);
    laserMesh.rotation.z = -this.playerAngle;

    this.scene.add(laserMesh);

    this.lasers.push({
      mesh: laserMesh,
      angle: this.playerAngle,
      z: z,
      zSpeed: -170, // fly forward down the tunnel
      isEnemy: false
    });
  }

  private shootEnemyLaser(enemy: Enemy) {
    if (!this.isRunning || !this.isGameplayActive) return;

    audioManager.playEnemyLaser();

    const placementRadius = this.TUNNEL_RADIUS - 1.2;
    const x = placementRadius * Math.sin(enemy.angle);
    const y = placementRadius * Math.cos(enemy.angle);
    const z = enemy.z + 1.2;

    const laserGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 4);
    laserGeo.rotateX(Math.PI / 2);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // hot pink enemy laser
    const laserMesh = new THREE.Mesh(laserGeo, laserMat);
    laserMesh.position.set(x, y, z);
    laserMesh.rotation.z = -enemy.angle;

    this.scene.add(laserMesh);

    // Speed increases slightly at higher difficulties
    const laserSpeed = 100 + (this.score / 150);

    this.lasers.push({
      mesh: laserMesh,
      angle: enemy.angle,
      z: z,
      zSpeed: laserSpeed, // fly forward towards player (positive Z)
      isEnemy: true
    });
  }

  // --- Game Loop and Updates ---

  public start() {
    this.isGameplayActive = true;
    this.baseSpeed = 50;
    this.speedMultiplier = 1.0;
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.getDelta();
    audioManager.startMusic();
    this.tick();
  }

  public startMenuDemo() {
    this.isGameplayActive = false;
    this.baseSpeed = 15;
    this.speedMultiplier = 1.0;
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.getDelta();
    this.tick();
  }

  public pause() {
    this.isRunning = false;
    audioManager.stopMusic();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public reset() {
    this.pause();
    this.score = 0;
    this.health = 3;
    this.speedMultiplier = 1.0;
    this.playerAngle = 0;
    this.targetPlayerAngle = 0;
    this.obstacleSpawnTimer = 0;

    // Clear old obstacles
    this.obstacles.forEach((obs) => {
      this.scene.remove(obs.mesh);
    });
    this.obstacles = [];

    // Clear old enemies
    this.enemies.forEach((enemy) => {
      this.scene.remove(enemy.mesh);
    });
    this.enemies = [];

    // Clear old lasers
    this.lasers.forEach((laser) => {
      this.scene.remove(laser.mesh);
      laser.mesh.geometry.dispose();
      (laser.mesh.material as THREE.Material).dispose();
    });
    this.lasers = [];

    // Clear old particles
    this.explosionParticles.forEach((p) => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    });
    this.explosionParticles = [];

    this.updatePlayerShipPosition();
    this.camera.position.copy(this.originalCameraPos);
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onHealthChange(this.health);
    this.callbacks.onSpeedChange(Math.round(this.baseSpeed * this.speedMultiplier));
  }

  private tick = () => {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame(this.tick);

    const dt = this.clock.getDelta();
    const clampedDt = Math.min(dt, 0.1);

    if (this.isGameplayActive) {
      this.updateScoreAndSpeed(clampedDt);
      this.updateControls(clampedDt);
      this.updateObstaclesAndEnemies(clampedDt);
      this.updateEnemies(clampedDt);
      this.updateLasers(clampedDt);
      this.checkCollisions();
    }

    this.updateTunnel(clampedDt);
    this.updateStarfield(clampedDt);
    this.updateParticles(clampedDt);
    this.updateCameraShake(clampedDt);

    // Subtle engine flame animation
    const flame = this.playerShip.getObjectByName('engineFlame');
    if (flame) {
      flame.scale.z = 0.8 + Math.sin(this.clock.getElapsedTime() * 30) * 0.2;
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updateScoreAndSpeed(dt: number) {
    this.speedMultiplier += dt * 0.012;
    
    const currentSpeed = this.baseSpeed * this.speedMultiplier;
    this.score += Math.round(currentSpeed * dt * 0.4);
    
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onSpeedChange(Math.round(currentSpeed));
    audioManager.setEngineSpeed(Math.min((this.speedMultiplier - 1) / 1.5, 1.0));
  }

  private updateControls(dt: number) {
    const keySensitivity = 4.0;
    let angleChange = 0;

    if (this.keyState['ArrowLeft'] || this.keyState['KeyA']) {
      angleChange -= keySensitivity * dt;
    }
    if (this.keyState['ArrowRight'] || this.keyState['KeyD']) {
      angleChange += keySensitivity * dt;
    }

    if (angleChange !== 0) {
      this.targetPlayerAngle += angleChange;
    }

    // Find shortest path for circular angle interpolation (prevents backwards-snapping across 0/2PI seam)
    let angleDiff = this.targetPlayerAngle - this.playerAngle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    const lerpFactor = 0.25;
    this.playerAngle += angleDiff * lerpFactor;
    
    this.playerAngle = (this.playerAngle + Math.PI * 2) % (Math.PI * 2);
    this.targetPlayerAngle = (this.targetPlayerAngle + Math.PI * 2) % (Math.PI * 2);

    this.updatePlayerShipPosition();
  }

  private updateTunnel(dt: number) {
    const currentSpeed = this.baseSpeed * this.speedMultiplier;
    
    this.tunnelSegments.forEach((segment) => {
      segment.position.z += currentSpeed * dt;

      if (segment.position.z > this.DESPAWN_Z + 10) {
        segment.position.z -= this.tunnelSegments.length * this.TUNNEL_LENGTH;
      }

      const rotSpeed = segment.position.z % 200 > 100 ? 0.05 : -0.05;
      segment.rotation.z += rotSpeed * dt;
    });
  }

  private updateStarfield(dt: number) {
    const currentSpeed = this.baseSpeed * this.speedMultiplier;
    const positions = this.starGeometry.attributes.position.array as Float32Array;

    for (let i = 0; i < positions.length / 3; i++) {
      const zSpeed = this.starSpeeds[i] * currentSpeed;
      positions[i * 3 + 2] += zSpeed * dt;

      if (positions[i * 3 + 2] > this.DESPAWN_Z) {
        positions[i * 3 + 2] = this.SPAWN_Z - Math.random() * 80;
        const r = this.TUNNEL_RADIUS + Math.random() * 25;
        const angle = Math.random() * Math.PI * 2;
        positions[i * 3] = r * Math.sin(angle);
        positions[i * 3 + 1] = r * Math.cos(angle);
      }
    }

    this.starGeometry.attributes.position.needsUpdate = true;
  }

  // --- Spawning Obstacles & Enemies ---

  private updateObstaclesAndEnemies(dt: number) {
    const currentSpeed = this.baseSpeed * this.speedMultiplier;
    
    this.obstacleSpawnTimer += dt;
    
    // Spawn rate increases at higher score
    const dynamicSpawnInterval = Math.max(
      (this.spawnInterval - (this.score > 2500 ? 0.45 : this.score > 800 ? 0.25 : 0)) / this.speedMultiplier,
      0.55
    );
    
    if (this.obstacleSpawnTimer >= dynamicSpawnInterval) {
      this.obstacleSpawnTimer = 0;
      
      // Enemies introduce from the start (score >= 0) to make combat active immediately
      let enemyChance = 0.22;
      if (this.score > 1800) {
        enemyChance = 0.48;
      } else if (this.score > 600) {
        enemyChance = 0.35;
      }
      
      if (Math.random() < enemyChance) {
        this.spawnEnemy();
      } else {
        this.spawnObstacle();
      }
    }

    // Move obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.mesh.position.z += obs.zSpeed * currentSpeed * dt;
      obs.mesh.rotation.x += dt * 1.5;
      obs.mesh.rotation.y += dt * 1.2;

      if (obs.mesh.position.z > this.SHIP_Z && !obs.passed) {
        obs.passed = true;
        this.score += 50;
        this.callbacks.onScoreChange(this.score);
      }

      if (obs.mesh.position.z > this.DESPAWN_Z) {
        this.scene.remove(obs.mesh);
        this.obstacles.splice(i, 1);
      }
    }
  }

  private spawnObstacle() {
    const obstacleGroup = new THREE.Group();

    const types: ('cube' | 'pyramid' | 'barrier')[] = ['cube', 'pyramid', 'barrier'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    const angle = Math.random() * Math.PI * 2;
    const distanceVal = this.TUNNEL_RADIUS - 1.2;

    const x = distanceVal * Math.sin(angle);
    const y = distanceVal * Math.cos(angle);
    const z = this.SPAWN_Z;

    obstacleGroup.position.set(x, y, z);
    obstacleGroup.rotation.z = -angle;

    const neonColors = [0xff00ff, 0x00f0ff, 0xffff00];
    const obstacleColor = neonColors[Math.floor(Math.random() * neonColors.length)];
    
    const mat = new THREE.MeshStandardMaterial({
      color: obstacleColor,
      roughness: 0.1,
      metalness: 0.9,
      flatShading: true,
    });

    const wireMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 1.5,
    });

    if (type === 'cube') {
      const size = 1.4 + Math.random() * 0.8;
      const geo = new THREE.BoxGeometry(size, size, size);
      const mesh = new THREE.Mesh(geo, mat);
      obstacleGroup.add(mesh);
      
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo), wireMat);
      obstacleGroup.add(wire);
    } else if (type === 'pyramid') {
      const height = 1.8 + Math.random() * 0.6;
      const geo = new THREE.ConeGeometry(1.0, height, 4);
      geo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      obstacleGroup.add(mesh);
      
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo), wireMat);
      obstacleGroup.add(wire);
    } else {
      const geo = new THREE.BoxGeometry(4.0, 0.4, 0.4);
      const mesh = new THREE.Mesh(geo, mat);
      obstacleGroup.add(mesh);
      
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo), wireMat);
      obstacleGroup.add(wire);
    }

    const light = new THREE.PointLight(obstacleColor, 3, 15);
    obstacleGroup.add(light);

    this.scene.add(obstacleGroup);

    this.obstacles.push({
      mesh: obstacleGroup,
      angle: angle,
      zSpeed: 1.0,
      type,
      passed: false,
    });
  }

  private spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const distanceVal = this.TUNNEL_RADIUS - 1.2;
    const x = distanceVal * Math.sin(angle);
    const y = distanceVal * Math.cos(angle);
    const z = this.SPAWN_Z;

    const color = 0xff00ff;
    const enemyMesh = this.createEnemyMesh(color);
    enemyMesh.position.set(x, y, z);
    enemyMesh.rotation.z = -angle;

    const light = new THREE.PointLight(color, 4, 15);
    enemyMesh.add(light);

    this.scene.add(enemyMesh);

    const shootInterval = Math.max(1.8 - (this.score / 6000), 0.75);

    this.enemies.push({
      mesh: enemyMesh,
      angle: angle,
      z: z,
      zSpeed: 0.85,
      health: 2,
      shootTimer: Math.random() * 0.8,
      shootInterval: shootInterval,
    });
  }

  private updateEnemies(dt: number) {
    const currentSpeed = this.baseSpeed * this.speedMultiplier;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      enemy.z += enemy.zSpeed * currentSpeed * dt;
      enemy.mesh.position.z = enemy.z;

      const driftSpeed = 0.6 + (this.score / 5000);
      enemy.angle += dt * driftSpeed;

      const placementRadius = this.TUNNEL_RADIUS - 1.2;
      enemy.mesh.position.x = placementRadius * Math.sin(enemy.angle);
      enemy.mesh.position.y = placementRadius * Math.cos(enemy.angle);
      enemy.mesh.rotation.z = -enemy.angle;

      enemy.shootTimer += dt;
      if (enemy.shootTimer >= enemy.shootInterval) {
        enemy.shootTimer = 0;
        this.shootEnemyLaser(enemy);
      }

      if (enemy.z > this.DESPAWN_Z) {
        this.scene.remove(enemy.mesh);
        this.enemies.splice(i, 1);
      }
    }
  }

  private updateLasers(dt: number) {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.z += laser.zSpeed * dt;
      laser.mesh.position.z = laser.z;

      if (laser.z < this.SPAWN_Z - 50 || laser.z > this.DESPAWN_Z) {
        this.scene.remove(laser.mesh);
        laser.mesh.geometry.dispose();
        (laser.mesh.material as THREE.Material).dispose();
        this.lasers.splice(i, 1);
      }
    }
  }

  // --- Collision Detection & Combat Actions ---

  private checkCollisions() {
    if (!this.isRunning) return;

    const shipAngle = this.playerAngle;
    const tolerance = 0.38;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      const zDistance = Math.abs(obs.mesh.position.z - this.SHIP_Z);

      if (zDistance < 1.4) {
        let diff = Math.abs(obs.angle - shipAngle);
        if (diff > Math.PI) {
          diff = Math.PI * 2 - diff;
        }

        const collisionLimit = obs.type === 'barrier' ? tolerance * 1.8 : tolerance;

        if (diff < collisionLimit) {
          this.triggerCollision(obs, i);
        }
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const zDistance = Math.abs(enemy.z - this.SHIP_Z);

      if (zDistance < 1.4) {
        let diff = Math.abs(enemy.angle - shipAngle);
        if (diff > Math.PI) {
          diff = Math.PI * 2 - diff;
        }

        if (diff < tolerance) {
          audioManager.playExplosion();
          this.createExplosion(enemy.mesh.position);
          this.scene.remove(enemy.mesh);
          this.enemies.splice(i, 1);

          this.health--;
          this.callbacks.onHealthChange(this.health);

          this.shakeIntensity = 0.45;
          this.glitchActive = true;
          this.glitchTimer = 0.15;

          if (this.health <= 0) {
            this.handleGameOver();
          }
        }
      }
    }

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      if (!laser.isEnemy) continue;

      const zDistance = Math.abs(laser.z - this.SHIP_Z);
      if (zDistance < 1.2) {
        let diff = Math.abs(laser.angle - shipAngle);
        if (diff > Math.PI) {
          diff = Math.PI * 2 - diff;
        }

        if (diff < 0.35) {
          this.triggerLaserHitPlayer(laser, i);
        }
      }
    }

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      if (laser.isEnemy) continue;

      let laserHit = false;
      for (let j = this.obstacles.length - 1; j >= 0; j--) {
        const obs = this.obstacles[j];
        const zDistance = Math.abs(laser.z - obs.mesh.position.z);
        if (zDistance < 1.6) {
          let diff = Math.abs(laser.angle - obs.angle);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;

          if (diff < 0.38) {
            this.triggerLaserHitObstacle(laser, i, obs, j);
            laserHit = true;
            break;
          }
        }
      }

      if (laserHit) continue;

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        const zDistance = Math.abs(laser.z - enemy.z);
        if (zDistance < 1.8) {
          let diff = Math.abs(laser.angle - enemy.angle);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;

          if (diff < 0.38) {
            this.triggerLaserHitEnemy(laser, i, enemy, j);
            break;
          }
        }
      }
    }
  }

  private triggerCollision(obs: Obstacle, index: number) {
    audioManager.playExplosion();
    this.createExplosion(obs.mesh.position);

    this.shakeIntensity = 0.45;
    this.glitchActive = true;
    this.glitchTimer = 0.15;

    this.health--;
    this.callbacks.onHealthChange(this.health);

    this.scene.remove(obs.mesh);
    this.obstacles.splice(index, 1);

    if (this.health <= 0) {
      this.handleGameOver();
    }
  }

  private triggerLaserHitPlayer(laser: Laser, index: number) {
    audioManager.playHit();

    this.shakeIntensity = 0.35;
    this.glitchActive = true;
    this.glitchTimer = 0.12;

    this.health--;
    this.callbacks.onHealthChange(this.health);

    this.scene.remove(laser.mesh);
    laser.mesh.geometry.dispose();
    (laser.mesh.material as THREE.Material).dispose();
    this.lasers.splice(index, 1);

    if (this.health <= 0) {
      this.handleGameOver();
    }
  }

  private triggerLaserHitObstacle(laser: Laser, laserIndex: number, obs: Obstacle, obsIndex: number) {
    this.scene.remove(laser.mesh);
    laser.mesh.geometry.dispose();
    (laser.mesh.material as THREE.Material).dispose();
    this.lasers.splice(laserIndex, 1);

    audioManager.playExplosion();
    this.createExplosion(obs.mesh.position);

    this.scene.remove(obs.mesh);
    this.obstacles.splice(obsIndex, 1);

    this.score += 100;
    this.callbacks.onScoreChange(this.score);
  }

  private triggerLaserHitEnemy(laser: Laser, laserIndex: number, enemy: Enemy, enemyIndex: number) {
    this.scene.remove(laser.mesh);
    laser.mesh.geometry.dispose();
    (laser.mesh.material as THREE.Material).dispose();
    this.lasers.splice(laserIndex, 1);

    enemy.health--;

    if (enemy.health <= 0) {
      audioManager.playExplosion();
      this.createExplosion(enemy.mesh.position);
      
      this.scene.remove(enemy.mesh);
      this.enemies.splice(enemyIndex, 1);

      this.score += 250;
      this.callbacks.onScoreChange(this.score);
    } else {
      audioManager.playHit();
      enemy.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          const originalColor = child.material.color.getHex();
          child.material.color.setHex(0xffffff);
          setTimeout(() => {
            if (child.parent) {
              child.material.color.setHex(originalColor);
            }
          }, 80);
        }
      });
    }
  }

  private handleGameOver() {
    this.pause();
    audioManager.playGameOver();
    this.callbacks.onGameOver(this.score);
  }

  // --- Visual & Particle Effects ---

  private createExplosion(pos: THREE.Vector3) {
    const particleCount = 25;
    const colors = [0xff00ff, 0x00f0ff, 0xffffff];

    for (let i = 0; i < particleCount; i++) {
      const size = 0.15 + Math.random() * 0.15;
      const geo = new THREE.BoxGeometry(size, size, size);
      
      const particleColor = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshBasicMaterial({
        color: particleColor,
        transparent: true,
        opacity: 1.0,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      );

      this.explosionParticles.push({
        position: mesh.position,
        velocity: velocity,
        color: new THREE.Color(particleColor),
        size: size,
        maxLife: 0.6,
        life: 0.6,
        mesh: mesh,
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
      const p = this.explosionParticles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.explosionParticles.splice(i, 1);
      } else {
        p.position.addScaledVector(p.velocity, dt);
        p.velocity.multiplyScalar(0.92);

        const progress = p.life / p.maxLife;
        p.mesh.scale.setScalar(progress);
        if (p.mesh.material) {
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = progress;
        }
      }
    }
  }

  private updateCameraShake(dt: number) {
    if (this.shakeIntensity > 0.01) {
      this.camera.position.x = this.originalCameraPos.x + (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y = this.originalCameraPos.y + (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.camera.position.copy(this.originalCameraPos);
    }

    if (this.glitchActive) {
      this.glitchTimer -= dt;
      if (this.glitchTimer <= 0) {
        this.glitchActive = false;
      }
    }
  }

  private triggerFlashEffect() {
    const ambient = this.scene.children.find(
      (c) => c instanceof THREE.AmbientLight
    ) as THREE.AmbientLight;
    
    if (ambient) {
      const originalIntensity = 0.4;
      ambient.intensity = 1.2;
      setTimeout(() => {
        ambient.intensity = originalIntensity;
      }, 80);
    }
  }

  // --- Resize and Cleanup ---

  public handleResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.renderer.setSize(width, height, false);
    
    const aspect = width / height;
    this.camera.aspect = aspect;
    
    // Dynamically expand Field of View (FOV) when screen is rotated to portrait/vertical (aspect < 1)
    // This pushes objects further out visually so they don't block the screen
    if (aspect < 1) {
      this.camera.fov = 65 + (1 - aspect) * 22;
    } else {
      this.camera.fov = 65;
    }
    
    this.camera.updateProjectionMatrix();
  }

  public cleanup() {
    this.pause();
    this.cleanupInput();

    this.obstacles.forEach((obs) => {
      this.scene.remove(obs.mesh);
    });
    this.obstacles = [];

    this.enemies.forEach((enemy) => {
      this.scene.remove(enemy.mesh);
    });
    this.enemies = [];

    this.lasers.forEach((laser) => {
      this.scene.remove(laser.mesh);
      laser.mesh.geometry.dispose();
      (laser.mesh.material as THREE.Material).dispose();
    });
    this.lasers = [];

    this.tunnelSegments.forEach((segment) => {
      segment.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.scene.remove(segment);
    });

    this.playerShip.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    this.scene.remove(this.playerShip);

    this.starGeometry.dispose();
    this.scene.remove(this.starfield);

    this.renderer.dispose();
  }
}
