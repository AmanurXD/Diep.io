import { System } from './System';
import { World } from '../World';
import { MAX_ENTITIES } from '../constants';
import { EntityType } from '../Types';

const INPUT_SHOOT = 16; // Bit 4 (10000)
const FIRE_RATE = 0.5;  // Seconds between shots

export class ShootingSystem implements System {
  public update(dt: number, world: World): void {
    const active = world.active.data;
    const type = world.type.data;
    const inputMask = world.inputMask.data;
    const reloadTimer = world.reloadTimer.data;
    const mouseAngle = world.mouseAngle.data;
    const x = world.x.data;
    const y = world.y.data;

    for (let i = 0; i < MAX_ENTITIES; i++) {
      if (active[i] === 0) continue;
      
      // Logic for Players only
      if (type[i] === EntityType.PLAYER) {
        
        // 1. Decrease Cooldown
        if (reloadTimer[i] > 0) {
          reloadTimer[i] -= dt;
        }

        // 2. Check Input
        if ((inputMask[i] & INPUT_SHOOT) === INPUT_SHOOT) {
          // 3. Fire if ready
          if (reloadTimer[i] <= 0) {
            world.spawnBullet(i, x[i], y[i], mouseAngle[i]);
            
            // Reset Cooldown
            reloadTimer[i] = FIRE_RATE;
          }
        }
      }
    }
  }
}