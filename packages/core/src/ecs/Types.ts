// packages/core/src/ecs/types.ts

// Shared game configuration
export const GAME_CONFIG = {
  SERVER_TICK_RATE: 20,  // 20 ticks per second (standard for .io games)
  WIDTH: 5000,
  HEIGHT: 5000,
};

// Entity categories/types used by the game
export enum EntityType {
  PLAYER = 0,
  BULLET = 1,
  SQUARE = 2,
  TRIANGLE = 3,
  PENTAGON = 4,
}

// Network packet opcodes
export enum PacketType {
  JOIN = 1,
  INPUT = 2,
  UPDATE = 3,
}
