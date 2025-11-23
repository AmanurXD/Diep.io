import { App, WebSocket, TemplatedApp } from 'uWebSockets.js';
import { 
  World, 
  MovementSystem, 
  SpatialHashGrid, 
  PacketBuilder, 
  GAME_CONFIG, 
  EntityType,
  decompressRotation,
  PacketType 
} from '@diep/core';

// NEW IMPORTS
import { ShootingSystem } from '@diep/core/src/ecs/systems/ShootingSystem';
import { LifetimeSystem } from '@diep/core/src/ecs/systems/LifetimeSystem';
import { CollisionSystem } from '@diep/core/src/ecs/systems/CollisionSystem';

const PORT = 9001;
const BROADCAST_TOPIC = 'game-state';

// 1. Initialize ECS and Physics
const world = new World();
const movementSystem = new MovementSystem();
const shootingSystem = new ShootingSystem(); // NEW
const lifetimeSystem = new LifetimeSystem(); // NEW
// 5000x5000 map, 100 unit cells
const spatialHash = new SpatialHashGrid(GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 100);
const collisionSystem = new CollisionSystem(spatialHash); // Inject Hash
const packetBuilder = new PacketBuilder();

// User Data Interface for the WebSocket
interface UserData {
  entityId: number;
}

// 2. Setup uWebSockets
const app = App()
  .ws<UserData>('/*', {
    compression: 0,
    maxPayloadLength: 16 * 1024,
    idleTimeout: 60,
    message: (ws, message, isBinary) => {
      if (!isBinary) return;

      const { entityId } = ws.getUserData();
      const view = new DataView(message);
      const opCode = view.getUint8(0);

      if (opCode === PacketType.INPUT) {
        // Packet structure: [Op(1), Mask(1), Angle(1)]
        if (view.byteLength < 3) return;

        const mask = view.getUint8(1);
        const angleByte = view.getUint8(2);

        // Update ECS directly
        // Validation: Ensure entity exists and is active
        if (world.active.data[entityId]) {
          world.inputMask.data[entityId] = mask;
          world.mouseAngle.data[entityId] = decompressRotation(angleByte);
          
          // Update rotation component for visual syncing
          world.rotation.data[entityId] = world.mouseAngle.data[entityId];
        }
      }
    },

    open: (ws) => {
      ws.subscribe(BROADCAST_TOPIC);

      const id = world.createEntity();
      // C. Random Spawn Position (Center of map is 2500, 2500)
      // Spawn between 1000 and 4000 to be safe
      const startX = 1000 + Math.random() * 3000;
      const startY = 1000 + Math.random() * 3000;

      world.type.data[id] = EntityType.PLAYER;
      world.x.data[id] = startX;
      world.y.data[id] = startY;
      world.active.data[id] = 1;
      world.vx.data[id] = (Math.random() - 0.5) * 100; 
      world.vy.data[id] = (Math.random() - 0.5) * 100;
      world.radius.data[id] = 25;

      // NEW: Health Stats
      world.health.data[id] = 100;
      world.maxHealth.data[id] = 100;

      ws.getUserData().entityId = id;

      console.log(`Client connected. Spawned Entity ${id} at ${startX.toFixed(0)}, ${startY.toFixed(0)}`);
    },
    close: (ws, code, message) => {
      const { entityId } = ws.getUserData();
      console.log(`Client disconnected. Removing Entity ${entityId}`);
      world.destroyEntity(entityId);
    }
  });

// ⭐ FIX: Call listen AFTER app is fully constructed
app.listen(PORT, (token) => {
  if (token) {
    console.log(`🚀 Server running on port ${PORT}`);
    startGameLoop(app);  // NOW it works, app is fully initialized
  } else {
    console.error(`❌ Failed to listen on port ${PORT}`);
  }
});

// Passing "0.0.0.0" as the host allows external connections
app.listen("0.0.0.0", PORT, (token) => {
  if (token) {
    console.log('Listening to port 3000 on all interfaces');
  } else {
    console.log('Failed to listen to port 3000');
  }
});

// 3. The Game Loop
function startGameLoop(server: TemplatedApp) {
  const dt = 1 / GAME_CONFIG.SERVER_TICK_RATE; // 0.05s

  setInterval(() => {
    // A. Logic Systems
    shootingSystem.update(dt, world);
    movementSystem.update(dt, world);
    lifetimeSystem.update(dt, world);

    // B. Physics Update (Spatial Hash)
    spatialHash.clear();
    const active = world.active.data;
    const x = world.x.data;
    const y = world.y.data;
    const r = world.radius.data;

    // Optimization: Only iterate active entities? 
    // For now, linear scan of max entities is fast enough for JS engines.
    for (let i = 0; i < world.entityManager.count; i++) {
      // Note: In a real scenario with recycling, we'd check active[i] 
      // inside a tighter loop or use a packed list of active IDs.
      if (active[i]) {
         spatialHash.insert(i, x[i], y[i]);
      }
    }
    // 3. Resolve Collisions
    collisionSystem.update(dt, world);
    
    // 4. Cleanup
    lifetimeSystem.update(dt, world);
    
    // C. Serialize State
    const dataView = packetBuilder.createUpdatePacket(world);

    // D. Broadcast
    // uWS expects ArrayBuffer or Uint8Array. DataView.buffer is the raw ArrayBuffer.
    // We slice it to send only the written bytes.
    const payload = new Uint8Array(dataView.buffer, 0, dataView.byteLength);
    server.publish(BROADCAST_TOPIC, payload, true); // true = isBinary

  }, 1000 / GAME_CONFIG.SERVER_TICK_RATE);
}
