import { Application, Graphics, Container } from 'pixi.js';
import { PacketParser, EntitySnapshot, EntityType, PacketType } from '@diep/core';
import { InputManager } from './InputManager';


// 1. Setup Pixi Application (v8 syntax)
const app = new Application();
let inputManager: InputManager | null = null;

// Async init is mandatory in v8

async function initGame() {
  await app.init({ 
    resizeTo: window,
    backgroundColor: 0xcdcdcd, // Light grey background (Diep style)
    antialias: true 
  });
  document.body.appendChild(app.canvas);

  // Game State
  const entities = new Map<number, Graphics>();
  const parser = new PacketParser();
  let serverSnapshots: EntitySnapshot[] = [];
  let myEntityId = -1;

  // Container for game world (camera logic goes here later)
  const worldContainer = new Container();

  // Optional: Add a grid background for visual reference of movement
  const grid = new Graphics();
  grid.rect(0, 0, 5000, 5000);
  grid.stroke({ width: 5, color: 0x000000, alpha: 0.1 });
  worldContainer.addChild(grid);  

  // Center the world container slightly (0,0 is center of screen)
  worldContainer.x = app.screen.width / 2;
  worldContainer.y = app.screen.height / 2;
  app.stage.addChild(worldContainer);

  // 2. Networking
  // Automatically uses the IP you used to load the page (e.g., 192.168.0.109)
  const socket = new WebSocket(`ws://${window.location.hostname}:9001`);
  socket.binaryType = 'arraybuffer';

  socket.onopen = () => {
    console.log('Connected to Game Server');
    inputManager = new InputManager(socket, app.canvas);
  };

  // NEW: Handle JOIN vs UPDATE packets
  socket.onmessage = (event) => {
    const buffer = event.data as ArrayBuffer;
    const view = new DataView(buffer);
    const opCode = view.getUint8(0);

    // 1. Handshake Packet
    if (opCode === PacketType.JOIN) {
      myEntityId = view.getUint16(1, true);
      console.log("✅ Identity Received: Entity ID", myEntityId);
    } 
    // 2. Update Packet
    else if (opCode === PacketType.UPDATE) {
      const data = parser.parseUpdatePacket(buffer);
      if (data) {
        serverSnapshots = data;
      }
    }
  };

  // --- Render Loop ---
  const lerp = (start: number, end: number, t: number) => {
    return start + (end - start) * t;
  };

  app.ticker.add(() => {
    const seenIds = new Set<number>();
    let myPlayer: EntitySnapshot | null = null;

    for (const snap of serverSnapshots) {
      seenIds.add(snap.id);
      let sprite = entities.get(snap.id);

      if (!sprite) {
        sprite = new Graphics();
        if (snap.type === EntityType.PLAYER) {
           // Body
           sprite.circle(0, 0, 25);
           sprite.fill(0x00b2e1); // Blue tank
           sprite.stroke({ width: 3, color: 0x0085a8 });
           
           // Simple Gun Barrel
           const barrel = new Graphics();
           barrel.rect(0, -10, 40, 20);
           barrel.fill(0x999999);
           barrel.stroke({ width: 3, color: 0x727272 });
           barrel.x = 15; 
           sprite.addChildAt(barrel, 0); 
        }
        // NEW: Bullet Rendering
        else if (snap.type === EntityType.BULLET) {
           sprite.circle(0, 0, 10); // Radius 10
           sprite.fill(0xF14E54);   // Red
           sprite.stroke({ width: 2, color: 0xB43A3F });
        }
        sprite.x = snap.x;
        sprite.y = snap.y;
        entities.set(snap.id, sprite);
        worldContainer.addChild(sprite);
      }

      // Interpolation
      sprite.x = lerp(sprite.x, snap.x, 0.2);
      sprite.y = lerp(sprite.y, snap.y, 0.2);
      sprite.rotation = snap.rotation;

      // NEW: Health Bar Logic
      // Only show for Players (or bosses later)
      if (snap.type === EntityType.PLAYER) {
        
        // Check if we already have a health bar child
        // We assume child index 1 is the health bar (0 is barrel)
        // Better approach: assign a name or property, but by index is faster.
        let healthBar = sprite.getChildByName('hp_bar') as Graphics;
        
        if (!healthBar) {
            healthBar = new Graphics();
            healthBar.label = 'hp_bar';
            healthBar.y = 35; // Position below tank
            sprite.addChild(healthBar);
        }
        
        healthBar.clear();
        
        // Background (Grey)
        healthBar.rect(-20, 0, 40, 6);
        healthBar.fill(0x555555);
        
        // Foreground (Green -> Red)
        const pct = snap.health / 255;
        const color = pct > 0.5 ? 0x00FF00 : 0xFF0000;
        
        healthBar.rect(-20, 0, 40 * pct, 6);
        healthBar.fill(color);
      }

      // --- FIXED CAMERA & INPUT LOGIC ---
      // Only track the entity that matches our ID from the handshake
      if (snap.id === myEntityId) {
        myPlayer = snap;
      }
    }

    // Remove dead entities
    for (const [id, sprite] of entities) {
      if (!seenIds.has(id)) {
        worldContainer.removeChild(sprite);
        sprite.destroy();
        entities.delete(id);
      }
    }

    // Center Camera on OUR player
    if (myPlayer) {
      const targetX = -myPlayer.x + app.screen.width / 2;
      const targetY = -myPlayer.y + app.screen.height / 2;
      
      worldContainer.x = lerp(worldContainer.x, targetX, 0.1);
      worldContainer.y = lerp(worldContainer.y, targetY, 0.1);
    }
  });
}

initGame();
