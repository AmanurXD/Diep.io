import { System } from './System';
import { World } from '../World';
import { MAX_ENTITIES } from '../constants';
import { GAME_CONFIG } from '../Types';


// Input Bit Flags
const INPUT_UP = 1;    // 0000 0001
const INPUT_DOWN = 2;  // 0000 0010
const INPUT_LEFT = 4;  // 0000 0100
const INPUT_RIGHT = 8; // 0000 1000


const PLAYER_SPEED = 200; // Pixels per second



export class MovementSystem implements System {
  public update(dt: number, world: World): void {
    // Direct access to arrays for performance
    const x = world.x.data;
    const y = world.y.data;
    const vx = world.vx.data;
    const vy = world.vy.data;
    const active = world.active.data;
    const inputMask = world.inputMask.data;
    const radius = world.radius.data; // Needed for boundary collision

    // Iterate over all potential entity slots
    // Optimization: In the future, we can maintain a packed list of active IDs 
    // to avoid iterating empty slots, but for <10k entities, a linear sweep 
    // is extremely fast in JS (SIMD-friendly).
    for (let i = 0; i < MAX_ENTITIES; i++) {
      if (active[i] === 0) continue;

      // 1. Handle Input (If entity has input data)
      const mask = inputMask[i];
      
      // Only modify velocity based on input if there IS input (e.g. Players)
      // Bullets will ignore this part and keep their initial velocity
      if (mask !== 0 || world.type.data[i] === 0) { // Type 0 = Player
        let dx = 0;
        let dy = 0;

        if (mask & INPUT_UP) dy -= 1;
        if (mask & INPUT_DOWN) dy += 1;
        if (mask & INPUT_LEFT) dx -= 1;
        if (mask & INPUT_RIGHT) dx += 1;

        // Normalize diagonal movement
        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx = (dx / length) * PLAYER_SPEED;
            dy = (dy / length) * PLAYER_SPEED;
        }

        vx[i] = dx;
        vy[i] = dy;
      }

      // 2. Apply Physics Integration
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;

      // 3. World Boundary Enforcement (Clamping)
      // Ensure entity stays strictly within 0 -> 5000
      const r = radius[i] || 0;
      
      if (x[i] < r) x[i] = r;
      if (x[i] > GAME_CONFIG.WIDTH - r) x[i] = GAME_CONFIG.WIDTH - r;
      
      if (y[i] < r) y[i] = r;
      if (y[i] > GAME_CONFIG.HEIGHT - r) y[i] = GAME_CONFIG.HEIGHT - r;
    }
  }
}
