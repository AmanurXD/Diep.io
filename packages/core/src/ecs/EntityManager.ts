import { MAX_ENTITIES } from './constants';

export class EntityManager {
  // Points to the next fresh ID to assign if recycle bin is empty
  private nextId: number = 0;

  // Stack logic for recycled IDs
  private recycledIds: Int32Array; 
  private recycledCount: number = 0;

  // Track total active entities for loop limits in Systems
  public count: number = 0;

  constructor() {
    // Pre-allocate the recycle stack to max size to prevent resizing
    this.recycledIds = new Int32Array(MAX_ENTITIES);
  }

  /**
   * Acquires an Entity ID.
   * Prefers recycled IDs to keep indices low.
   */
  public createEntity(): number {
    if (this.count >= MAX_ENTITIES) {
      throw new Error("MAX_ENTITIES limit reached. Increase limit in constants.");
    }

    this.count++;

    // 1. Check recycle bin
    if (this.recycledCount > 0) {
      this.recycledCount--;
      return this.recycledIds[this.recycledCount];
    }

    // 2. Create fresh ID
    return this.nextId++;
  }

  /**
   * Releases an Entity ID back to the pool.
   */
  public removeEntity(id: number): void {
    // Guard against double-freeing or invalid IDs could go here
    // but omitted for raw performance.
    
    this.recycledIds[this.recycledCount] = id;
    this.recycledCount++;
    this.count--;
  }

  /**
   * Reset the manager (e.g. map change)
   */
  public reset(): void {
    this.nextId = 0;
    this.recycledCount = 0;
    this.count = 0;
  }
}