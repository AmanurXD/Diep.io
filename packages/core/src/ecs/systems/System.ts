import { World } from '../World';

export interface System {
  update(dt: number, world: World): void;
}