import { EntityManager } from './EntityManager';
import { ComponentStorage } from './ComponentStorage';

export class World {
  public entityManager: EntityManager;

  // --- COMPONENTS (Structure of Arrays) ---

  // Transform
  public x: ComponentStorage<Float32Array>;
  public y: ComponentStorage<Float32Array>;
  public rotation: ComponentStorage<Float32Array>;

  // Velocity
  public vx: ComponentStorage<Float32Array>;
  public vy: ComponentStorage<Float32Array>;
  
  // --- NEW: Input Components ---
  // Bitmask: [Bit 0: Up, 1: Down, 2: Left, 3: Right, 4: Shoot]
  public inputMask: ComponentStorage<Uint8Array>;

  // Mouse Angle in Radians (Server stores radians for math, receives compressed byte)
  public mouseAngle: ComponentStorage<Float32Array>;

  // Physics
  public radius: ComponentStorage<Float32Array>;
  public mass: ComponentStorage<Float32Array>;
  // Active flag: 0 = dead, 1 = active. 
  // Using Uint8 allows us to use bitwise flags later if needed.
  public active: ComponentStorage<Uint8Array>;

  // Identity
  // Type ID (0=Player, 1=Bullet, etc.)
  public type: ComponentStorage<Uint8Array>;
  
  // Optional: Player Owner ID (for bullets/drones)
  public ownerId: ComponentStorage<Int16Array>;

  constructor() {
    this.entityManager = new EntityManager();

    // Initialize Arrays
    // Float32 is standard for positions/physics (precision vs memory balance)
    this.x = new ComponentStorage(Float32Array);
    this.y = new ComponentStorage(Float32Array);
    this.rotation = new ComponentStorage(Float32Array);

    this.vx = new ComponentStorage(Float32Array);
    this.vy = new ComponentStorage(Float32Array);

    // Initialize Input Storage
    this.inputMask = new ComponentStorage(Uint8Array);
    this.mouseAngle = new ComponentStorage(Float32Array);

    this.radius = new ComponentStorage(Float32Array);
    this.mass = new ComponentStorage(Float32Array);
    
    // Uint8 is sufficient for booleans/enums < 255
    this.active = new ComponentStorage(Uint8Array);
    this.type = new ComponentStorage(Uint8Array);
    
    // Int16 allows IDs up to 32,767 (sufficient for MAX_ENTITIES 10,000)
    this.ownerId = new ComponentStorage(Int16Array);
  }

  /**
   * Spawns a new entity and returns its ID.
   * Automatically resets component data for that ID.
   */
  public createEntity(): number {
    const id = this.entityManager.createEntity();
    
    // Reset basic components to ensure no "ghost" velocity/logic
    // from the previous user of this ID.
    this.x.reset(id);
    this.y.reset(id);
    this.rotation.reset(id);
    this.vx.reset(id);
    this.vy.reset(id);
    this.radius.reset(id);
    this.mass.reset(id);
    this.active.data[id] = 1; // Mark as active immediately
    this.type.reset(id);
    this.ownerId.reset(id);
    // Reset Input
    this.inputMask.reset(id);
    this.mouseAngle.reset(id);
    return id;
  }

  /**
   * Removes an entity.
   */
  public destroyEntity(id: number): void {
    this.active.data[id] = 0; // Mark inactive immediately
    this.entityManager.removeEntity(id);
  }
}