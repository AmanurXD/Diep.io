import { Application, Graphics, Container } from 'pixi.js';
import { PacketParser, EntitySnapshot, EntityType, PacketType } from '@diep/core';
import { InputManager } from './InputManager';

// --- Global Application Setup (Runs once on page load) ---
const app = new Application();
const parser = new PacketParser();
const worldContainer = new Container();
const grid = new Graphics();

// --- Game Session State (Managed across the game lifecycle) ---
const entities = new Map<number, Graphics>();
let serverSnapshots: EntitySnapshot[] = [];
let myEntityId = -1;
let inputManager: InputManager | null = null;
let socket: WebSocket | null = null;

// Explicitly manage the game state
type GameStateType = 'connecting' | 'playing' | 'dead';
let gameState: GameStateType = 'connecting';

// --- UI Initialization ---
const createGameOverUI = () => {
  const div = document.createElement('div');
  div.id = 'game-over';
  div.style.position = 'absolute';
  div.style.top = '50%';
  div.style.left = '50%';
  div.style.transform = 'translate(-50%, -50%)';
  div.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  div.style.padding = '20px';
  div.style.borderRadius = '10px';
  div.style.color = 'white';
  div.style.fontFamily = 'Arial, sans-serif';
  div.style.fontSize = '24px';
  div.style.textAlign = 'center';
  div.style.cursor = 'pointer';
  div.style.display = 'none';
  div.innerHTML = `
      <h2 style="margin: 0 0 10px 0; color: #ff4444;">YOU DIED</h2>
      <p style="margin: 0;">Click to Respawn</p>
    `;
  
  // CRITICAL CHANGE: Reconnect instead of window.location.reload()
  div.onclick = () => {
    if (gameState === 'dead') {
        console.log("Respawning...");
        connectToServer(); 
    }
  };
  document.body.appendChild(div);
  return div;
};

const gameOverDiv = createGameOverUI();

// --- Application Initialization (Runs once) ---
async function initializeApp() {
  await app.init({ 
    resizeTo: window,
    backgroundColor: 0xcdcdcd, 
    antialias: true 
  });
  document.body.appendChild(app.canvas);

  // Grid Setup
  grid.rect(0, 0, 5000, 5000);
  grid.stroke({ width: 5, color: 0x000000, alpha: 0.1 });
  worldContainer.addChild(grid); // Grid is persistent
  
  // World Container Setup
  worldContainer.x = app.screen.width / 2;
  worldContainer.y = app.screen.height / 2;
  app.stage.addChild(worldContainer);

  // Start the render loop (Ticker runs continuously)
  app.ticker.add(renderLoop);

  // Start the first connection
  connectToServer();
}

// --- Game State Management ---

/**
 * Cleans up the previous game session entirely.
 * This prevents ghost entities and synchronization issues.
 */
function cleanupGameState() {
    console.log("Cleaning up previous game state...");

    // 1. Network Cleanup
    if (socket) {
        // Important: Prevent triggering handleDeath() on intentional close during respawn
        socket.onclose = null; 
        socket.onerror = null;
        socket.close();
        socket = null;
    }

    // 2. Input Cleanup
    if (inputManager) {
        inputManager.destroy();
        inputManager = null;
    }
    
    // 3. Entity Cleanup (Fixes vanishing/ghost players issue)
    // We must destroy all sprites and clear the map.
    for (const sprite of entities.values()) {
        // Remove from scene and destroy the sprite and its children (like the barrel and health bar)
        worldContainer.removeChild(sprite);
        sprite.destroy({ children: true }); 
    }
    entities.clear();

    // 4. Reset Variables
    myEntityId = -1;
    serverSnapshots = [];
}

// Handles death event
function handleDeath() {
  // Only trigger death if not already dead
  if (gameState === 'dead') return; 
  
  console.log("💀 YOU DIED (ID Lost, Recycled, or Disconnected)");
  gameState = 'dead';
  myEntityId = -1;

  // Stop sending inputs
  if (inputManager) {
      inputManager.destroy();
      inputManager = null;
  }

  // Show UI
  gameOverDiv.style.display = 'block';
};

// --- Connection Management ---
function connectToServer() {
    // Clean up previous game state before starting new connection
    cleanupGameState();

    console.log("Attempting to connect...");
    gameState = 'connecting';
    gameOverDiv.style.display = 'none'; // Hide UI

    socket = new WebSocket(`ws://${window.location.hostname}:9001`);
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
        console.log('Connected to Game Server');
        // We wait for the JOIN packet before confirming we are 'playing'.
    };

    socket.onmessage = handleMessage;
    
    // Handle unexpected disconnections
    socket.onclose = (event) => {
        console.log("Disconnected from server.", event.code, event.reason);
        // If we were playing or connecting, treat disconnection as death/failure
        if (gameState !== 'dead') {
            handleDeath();
        }
    }

    socket.onerror = (error) => {
        console.error("WebSocket Error:", error);
        handleDeath();
    }
}

// --- Message Handling ---
function handleMessage(event: MessageEvent) {
    // Ensure the message belongs to the current active socket
    if (event.target !== socket || !socket) return; 

    const buffer = event.data as ArrayBuffer;
    const view = new DataView(buffer);
    const opCode = view.getUint8(0);

    if (opCode === PacketType.JOIN) {
      myEntityId = view.getUint16(1, true);
      console.log("✅ Identity Received: Entity ID", myEntityId);
      gameState = 'playing';
      
      // Start InputManager now that we are alive, connected, and have an identity
      if (!inputManager) {
         inputManager = new InputManager(socket, app.canvas);
      }

    } 
    else if (opCode === PacketType.UPDATE) {
      const data = parser.parseUpdatePacket(buffer);
      if (data) serverSnapshots = data;
    }
};

// --- Render Loop ---
const lerp = (start: number, end: number, t: number) => {
  return start + (end - start) * t;
};

function renderLoop() {
    // Optimization: Don't process updates while connecting, wait for the session to stabilize.
    if (gameState === 'connecting') {
        return;
    }

    const seenIds = new Set<number>();
    let myPlayer: EntitySnapshot | null = null;
    let myIdFoundInSnapshot = false;
    
    for (const snap of serverSnapshots) {
      seenIds.add(snap.id);
      let sprite = entities.get(snap.id);

      // Entity Creation
      if (!sprite) {
        sprite = new Graphics();
        if (snap.type === EntityType.PLAYER) {
           sprite.circle(0, 0, 25);
           sprite.fill(0x00b2e1);
           sprite.stroke({ width: 3, color: 0x0085a8 });
           
           const barrel = new Graphics();
           barrel.rect(0, -10, 40, 20);
           barrel.fill(0x999999);
           barrel.stroke({ width: 3, color: 0x727272 });
           barrel.x = 15; 
           sprite.addChildAt(barrel, 0); 
        }
        else if (snap.type === EntityType.BULLET) {
           sprite.circle(0, 0, 10);
           sprite.fill(0xF14E54);
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

      // Health Bar (Players Only)
      if (snap.type === EntityType.PLAYER) {
        // Note: In PixiJS v8, 'label' is often used if 'name' is not set.
        let healthBar = sprite.getChildByName('hp_bar') as Graphics;
        if (!healthBar) {
            healthBar = new Graphics();
            healthBar.label = 'hp_bar'; 
            healthBar.y = 35;
            sprite.addChild(healthBar);
        }
        healthBar.clear();
        healthBar.rect(-20, 0, 40, 6);
        healthBar.fill(0x555555);
        
        const pct = snap.health / 255;
        const color = pct > 0.5 ? 0x00FF00 : 0xFF0000;
        healthBar.rect(-20, 0, 40 * pct, 6);
        healthBar.fill(color);
      }

      // --- IDENTITY VERIFICATION (ID Recycling Fix) ---
      if (snap.id === myEntityId) {
        myIdFoundInSnapshot = true;
        
        // Only check for recycling if we believe we are playing
        if (gameState === 'playing') {
            if (snap.type === EntityType.PLAYER) {
              myPlayer = snap;
            } else {
              // ID mismatch! Our ID was recycled (e.g., to a Bullet).
              console.log("Death detected: ID Recycled.");
              handleDeath();
            }
        }
      }
    }

    // --- DEATH DETECTION (ID Vanished Fix) ---
    if (gameState === 'playing' && myEntityId !== -1 && !myIdFoundInSnapshot) {
        // If we are playing, and our ID is missing from the update, we likely died.
        // We check if the snapshot length > 0 to ensure we actually received data, 
        // preventing false deaths due to network lag spikes where an empty update arrives.
        if (serverSnapshots.length > 0) {
            console.log("Death detected: ID missing from snapshot.");
            handleDeath();
        }
    }

    // Cleanup Dead Entities (that disappeared from the server view)
    for (const [id, sprite] of entities) {
      if (!seenIds.has(id)) {
        worldContainer.removeChild(sprite);
        sprite.destroy({ children: true });
        entities.delete(id);
      }
    }

    // Camera Logic
    // Only follow if we are playing AND we found our player snapshot
    if (gameState === 'playing' && myPlayer) {
      const targetX = -myPlayer.x + app.screen.width / 2;
      const targetY = -myPlayer.y + app.screen.height / 2;
      
      worldContainer.x = lerp(worldContainer.x, targetX, 0.1);
      worldContainer.y = lerp(worldContainer.y, targetY, 0.1);
    } 
    // If dead or connecting, the camera stays at the last position.
}

// Start the application
initializeApp();