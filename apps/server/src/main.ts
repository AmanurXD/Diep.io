import { App, TemplatedApp } from 'uWebSockets.js';

import {
  World,
  MovementSystem,
  SpatialHashGrid,
  PacketBuilder,
  GAME_CONFIG,
  EntityType,
  decompressRotation,
  PacketType,
  ShootingSystem,
  LifetimeSystem,
  CollisionSystem
} from '@diep/core';

interface UserData {
  entityId: number;
}

const PORT = 9001;
const BROADCAST_TOPIC = 'game-state';

// ECS + Systems
const world = new World();
const movementSystem = new MovementSystem();
const shootingSystem = new ShootingSystem();
const lifetimeSystem = new LifetimeSystem();

const spatialHash = new SpatialHashGrid(
  GAME_CONFIG.WIDTH,
  GAME_CONFIG.HEIGHT,
  100
);

const collisionSystem = new CollisionSystem(spatialHash);

const packetBuilder = new PacketBuilder();

// uWebSocket Server
const app = App().ws<UserData>('/*', {
  idleTimeout: 60,
  maxPayloadLength: 16 * 1024,

  open: (ws) => {
    try {
      ws.subscribe(BROADCAST_TOPIC);

      const id = world.createEntity();

      // random safe spawn
      const startX = 1000 + Math.random() * 3000;
      const startY = 1000 + Math.random() * 3000;

      world.type.data[id] = EntityType.PLAYER;
      world.x.data[id] = startX;
      world.y.data[id] = startY;
      world.active.data[id] = 1;

      world.vx.data[id] = 0;
      world.vy.data[id] = 0;
      world.radius.data[id] = 25;

      // fix ghost health
      world.health.data[id] = 100;
      world.maxHealth.data[id] = 100;

      ws.getUserData().entityId = id;

      // send JOIN packet
      const buf = new ArrayBuffer(3);
      const dv = new DataView(buf);
      dv.setUint8(0, PacketType.JOIN);
      dv.setUint16(1, id, true);
      ws.send(buf, true);

      console.log(`🎮 Spawned player ${id} at (${startX.toFixed(0)}, ${startY.toFixed(0)})`);
    } catch (error) {
      console.error('❌ Failed to spawn player:', error);
      ws.close();
    }
  },

  message: (ws, message, isBinary) => {
    if (!isBinary) return;

    const view = new DataView(message);
    const op = view.getUint8(0);

    const { entityId } = ws.getUserData();
    if (!world.active.data[entityId]) return;

    if (op === PacketType.INPUT) {
      if (view.byteLength < 3) return;

      const mask = view.getUint8(1);
      const angleByte = view.getUint8(2);

      world.inputMask.data[entityId] = mask;
      world.mouseAngle.data[entityId] = decompressRotation(angleByte);
      world.rotation.data[entityId] = world.mouseAngle.data[entityId];
    }
  },

  close: (ws, code) => {
    const { entityId } = ws.getUserData();

    console.log(`🔌 Player ${entityId} disconnected (code: ${code})`);

    if (world.active.data[entityId]) {
      setTimeout(() => {
        world.destroyEntity(entityId);
      }, 100);
    }
  }
});

// listen
app.listen('0.0.0.0', PORT, (token) => {
  if (token) {
    console.log(`🚀 Server running on port ${PORT}`);
    startGameLoop(app);
  } else {
    console.error('❌ Failed to listen on port');
  }
});

// Game loop
function startGameLoop(server: TemplatedApp) {
  const dt = 1 / GAME_CONFIG.SERVER_TICK_RATE;

  setInterval(() => {
    // logic systems
    shootingSystem.update(dt, world);
    movementSystem.update(dt, world);
    lifetimeSystem.update(dt, world);

    // physics
    spatialHash.clear();
    const active = world.active.data;
    const x = world.x.data;
    const y = world.y.data;

    for (let i = 0; i < world.entityManager.count; i++) {
      if (active[i]) {
        spatialHash.insert(i, x[i], y[i]);
      }
    }

    collisionSystem.update(dt, world);

    // create update packet
    const dv = packetBuilder.createUpdatePacket(world);
    const payload = new Uint8Array(dv.buffer, 0, dv.byteLength);

    server.publish(BROADCAST_TOPIC, payload, true);
  }, 1000 / GAME_CONFIG.SERVER_TICK_RATE);
}
