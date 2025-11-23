import { System } from './System';
import { World } from '../World';
import { SpatialHashGrid } from '../../physics/SpatialHashGrid';
import { EntityType } from '../Types';
import { MAX_ENTITIES } from '../constants';

export class CollisionSystem implements System {
  private spatialHash: SpatialHashGrid;

  constructor(spatialHash: SpatialHashGrid) {
    this.spatialHash = spatialHash;
  }

  public update(dt: number, world: World): void {
    const active = world.active.data;
    const type = world.type.data;
    const x = world.x.data;
    const y = world.y.data;
    const r = world.radius.data;
    const ownerId = world.ownerId.data;
    const damage = world.damage.data;
    const health = world.health.data;

    // Iterate over all active entities
    for (let id = 0; id < MAX_ENTITIES; id++) {
      if (active[id] === 0) continue;

      // We only care about Bullets initiating collisions here
      if (type[id] !== EntityType.BULLET) continue;

      // 1. Query Spatial Hash for neighbors
      // We look for things within bullet radius + max target radius (approx 50)
      const count = this.spatialHash.query(x[id], y[id], r[id] + 50);
      const neighbors = this.spatialHash.queryResults;

      for (let n = 0; n < count; n++) {
        const targetId = neighbors[n];

        // --- Collision Rules ---
        
        // A. Don't collide with self
        if (id === targetId) continue;
        
        // B. Don't collide with owner (No friendly fire)
        if (targetId === ownerId[id]) continue;
        
        // C. Don't collide with other bullets (for now)
        if (type[targetId] === EntityType.BULLET) continue;

        // D. Check exact distance
        const dx = x[id] - x[targetId];
        const dy = y[id] - y[targetId];
        const distSq = dx * dx + dy * dy;
        const radSum = r[id] + r[targetId];

        if (distSq < radSum * radSum) {
          // --- HIT REGISTERED ---

          // 1. Apply Damage to Target
          health[targetId] -= damage[id];

          // 2. Destroy Bullet immediately
          world.destroyEntity(id);

          // 3. Check Target Death
          if (health[targetId] <= 0) {
            world.destroyEntity(targetId);
            // Optional: Grant XP to ownerId[id] here
          }

          // Break out of neighbor loop since bullet is gone
          break;
        }
      }
    }
  }
}