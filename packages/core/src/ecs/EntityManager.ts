// packages/core/src/ecs/EntityManager.ts
import { MAX_ENTITIES } from './constants';

export class EntityManager {
  private nextId: number = 0;
  private recycledIds: Int32Array;
  private recycledCount: number = 0;
  public count: number = 0;

  // 🔒 ID PROTECTION SYSTEM
  private destroyedTimestamps: Int32Array; // Track when IDs were destroyed
  private readonly RECYCLE_DELAY_MS = 5000; // 5 second safety window

  constructor() {
    this.recycledIds = new Int32Array(MAX_ENTITIES);
    this.destroyedTimestamps = new Int32Array(MAX_ENTITIES);
  }

  public createEntity(): number {
    if (this.count >= MAX_ENTITIES) {
      throw new Error("MAX_ENTITIES limit reached.");
    }

    this.count++;

    // 1. Check recycle bin with timestamp validation
    const now = Date.now();
    while (this.recycledCount > 0) {
      const candidateId = this.recycledIds[this.recycledCount - 1];
      const timeDestroyed = this.destroyedTimestamps[candidateId];
      
      // Only recycle if enough time has passed
      if (now - timeDestroyed >= this.RECYCLE_DELAY_MS) {
        this.recycledCount--;
        console.log(`♻️ Recycled ID ${candidateId} after ${now - timeDestroyed}ms`);
        return candidateId;
      } else {
        // This ID isn't safe yet, try next one
        break;
      }
    }

    // 2. Create fresh ID
    const freshId = this.nextId++;
    if (freshId >= MAX_ENTITIES) {
      throw new Error("MAX_ENTITIES limit reached.");
    }
    
    console.log(`🆕 Created fresh ID ${freshId}`);
    return freshId;
  }

  public removeEntity(id: number): void {
    // Record destruction timestamp
    this.destroyedTimestamps[id] = Date.now();
    
    this.recycledIds[this.recycledCount] = id;
    this.recycledCount++;
    this.count--;
    
    console.log(`🗑️  Marked ID ${id} for recycling`);
  }

  public reset(): void {
    this.nextId = 0;
    this.recycledCount = 0;
    this.count = 0;
    this.destroyedTimestamps.fill(0);
  }

  // Debug method to check recycling status
  public getRecycleStatus(): { available: number, delayed: number } {
    const now = Date.now();
    let available = 0;
    let delayed = 0;

    for (let i = 0; i < this.recycledCount; i++) {
      const id = this.recycledIds[i];
      if (now - this.destroyedTimestamps[id] >= this.RECYCLE_DELAY_MS) {
        available++;
      } else {
        delayed++;
      }
    }

    return { available, delayed };
  }
}