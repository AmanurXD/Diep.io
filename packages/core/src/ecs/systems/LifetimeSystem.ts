import { System } from './System';
import { World } from '../World';
import { MAX_ENTITIES } from '../constants';

export class LifetimeSystem implements System {
  public update(dt: number, world: World): void {
    const active = world.active.data;
    const timeToLive = world.timeToLive.data;

    for (let i = 0; i < MAX_ENTITIES; i++) {
      if (active[i] === 0) continue;

      // Only process entities with a positive TTL (Bullets)
      // Players will have TTL = 0 (Infinite)
      if (timeToLive[i] > 0) {
        timeToLive[i] -= dt;

        if (timeToLive[i] <= 0) {
          world.destroyEntity(i);
        }
      }
    }
  }
}