import { EntityManager } from './EntityManager';
import { ComponentStorage } from './ComponentStorage';
import { EntityType } from '../index';
import { System } from './systems/System';
import { MAX_ENTITIES } from './constants';



export class World {
  public entityManager: EntityManager;
  public systems: System[] = [];

  // --- TRANSFORM ---
  public x: ComponentStorage<Float32Array>;
  public y: ComponentStorage<Float32Array>;
  public rotation: ComponentStorage<Float32Array>;

  // --- PHYSICS ---
  public vx: ComponentStorage<Float32Array>;
  public vy: ComponentStorage<Float32Array>;
  public radius: ComponentStorage<Float32Array>;
  public mass: ComponentStorage<Float32Array>;
  public active: ComponentStorage<Uint8Array>;

  // --- COMBAT (NEW) ---
  public health: ComponentStorage<Float32Array>;
  public maxHealth: ComponentStorage<Float32Array>;
  public damage: ComponentStorage<Float32Array>;

  // --- IDENTITY ---
  public type: ComponentStorage<Uint8Array>;
  public ownerId: ComponentStorage<Int32Array>; // Changed to Int32 for safety (-1 support)

  // --- INPUT ---
  public inputMask: ComponentStorage<Uint8Array>;
  public mouseAngle: ComponentStorage<Float32Array>;

  // --- GAMEPLAY (NEW) ---
  public reloadTimer: ComponentStorage<Float32Array>; // Cooldown in seconds
  public timeToLive: ComponentStorage<Float32Array>;  // Lifetime in seconds (0 = infinite)

  constructor() {
    this.entityManager = new EntityManager();

    // Init Arrays
    this.x = new ComponentStorage(Float32Array);
    this.y = new ComponentStorage(Float32Array);
    this.rotation = new ComponentStorage(Float32Array);
    this.vx = new ComponentStorage(Float32Array);
    this.vy = new ComponentStorage(Float32Array);
    this.radius = new ComponentStorage(Float32Array);
    this.mass = new ComponentStorage(Float32Array);
    this.active = new ComponentStorage(Uint8Array);
    this.type = new ComponentStorage(Uint8Array);
    this.ownerId = new ComponentStorage(Int32Array);
    this.inputMask = new ComponentStorage(Uint8Array);
    this.mouseAngle = new ComponentStorage(Float32Array);
    
    // New Gameplay Arrays
    this.reloadTimer = new ComponentStorage(Float32Array);
    this.timeToLive = new ComponentStorage(Float32Array);
    // Init New Arrays
    this.health = new ComponentStorage(Float32Array);
    this.maxHealth = new ComponentStorage(Float32Array);
    this.damage = new ComponentStorage(Float32Array);
  }

  public createEntity(): number {
    const id = this.entityManager.createEntity();
    
    // Reset all components to safe defaults
    this.x.reset(id);
    this.y.reset(id);
    this.rotation.reset(id);
    this.vx.reset(id);
    this.vy.reset(id);
    this.radius.reset(id);
    this.mass.reset(id);
    this.active.data[id] = 1;
    this.type.reset(id);
    this.ownerId.data[id] = -1; // Default to no owner
    this.inputMask.reset(id);
    this.mouseAngle.reset(id);
    this.reloadTimer.reset(id);
    this.timeToLive.reset(id);

    // Reset New Components
    this.health.reset(id);
    this.maxHealth.reset(id);
    this.damage.reset(id);

    return id;
  }

  // 🔒 Track recently destroyed entities for client sync
  private recentlyDestroyed: Set<number> = new Set();

  public destroyEntity(id: number): void {
    // 1. SAFEGUARD: If already dead/inactive, do nothing.
    if (this.active.data[id] === 0) {
      console.warn(`⚠️ Attempted to destroy already inactive entity ${id}`);
      return;
    }

    // 2. Mark inactive immediately
    this.active.data[id] = 0;

    // 3. Clear critical data (Optional but good for debugging)
    // 4. Clear critical data that could cause "ghost" behavior
    this.type.data[id] = 0;
    this.ownerId.data[id] = -1;

    // Important: Keep position data for smooth client-side interpolation
    // but clear movement/control data
    this.vx.data[id] = 0;
    this.vy.data[id] = 0;
    this.inputMask.data[id] = 0;

    // 5. Return ID to the pool (with timestamp protection)
    this.entityManager.removeEntity(id);

    console.log(`💀 Destroyed entity ${id}, active count: ${this.entityManager.count}`);
  }


  /**
   * Clean up the recently destroyed set to prevent memory leaks
   * Call this after broadcasting destruction to clients
   */
  public cleanupDestroyedEntities(): void {
    this.recentlyDestroyed.clear();
  }


  /**
   * Check if an entity was recently destroyed (for client validation)
   */
  public wasRecentlyDestroyed(id: number): boolean {
    return this.recentlyDestroyed.has(id);
  }


  public addSystem(system: System): void {
    this.systems.push(system);
  }

  public update(dt: number): void {
    for (const system of this.systems) {
      system.update(dt, this);
    }
  }


  /**
   * Helper to spawn a standard bullet
   */
  public spawnBullet(ownerId: number, x: number, y: number, angle: number): void {
    const id = this.createEntity();
    
    // 1. Stats
    const speed = 600;
    const lifetime = 3.0; // 3 seconds
    const bulletRadius = 10;
    const bulletDamage = 10; // Standard damage

    // 2. Position (Offset slightly so it doesn't spawn INSIDE the tank)
    // Tank Radius ~25, Bullet Radius ~10. Offset = 35.
    const offset = 35;
    this.x.data[id] = x + Math.cos(angle) * offset;
    this.y.data[id] = y + Math.sin(angle) * offset;
    
    // 3. Velocity
    this.vx.data[id] = Math.cos(angle) * speed;
    this.vy.data[id] = Math.sin(angle) * speed;

    // 4. Components
    this.rotation.data[id] = angle;
    this.radius.data[id] = bulletRadius;
    this.type.data[id] = EntityType.BULLET;
    this.ownerId.data[id] = ownerId;
    this.timeToLive.data[id] = lifetime;

    // Bullet Stats
    this.damage.data[id] = bulletDamage;
    this.health.data[id] = 1; // Bullets technically have 1 HP
    this.maxHealth.data[id] = 1;

  }
}
