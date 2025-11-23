import { PacketType, compressRotation } from '@diep/core';

export class InputManager {
  private socket: WebSocket;
  private canvas: HTMLCanvasElement;

  // Input State
  private keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
  };
  private mouseAngle: number = 0;
  private isShooting: boolean = false;

  // Transmission Loop
  private intervalId: number | null = null;

  constructor(socket: WebSocket, canvas: HTMLCanvasElement) {
    this.socket = socket;
    this.canvas = canvas;
    this.setupListeners();
    this.startTransmission();
  }

  private setupListeners() {
    window.addEventListener('keydown', (e) => {
      if (this.keys.hasOwnProperty(e.key)) {
        (this.keys as any)[e.key] = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.keys.hasOwnProperty(e.key)) {
        (this.keys as any)[e.key] = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      // Calculate angle relative to center of screen (since camera is centered on player)
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      this.mouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    });

    window.addEventListener('mousedown', () => { this.isShooting = true; });
    window.addEventListener('mouseup', () => { this.isShooting = false; });
  }

  private startTransmission() {
    // Send input at 20Hz (50ms)
    this.intervalId = window.setInterval(() => {
      this.sendInputPacket();
    }, 50);
  }

  private sendInputPacket() {
    if (this.socket.readyState !== WebSocket.OPEN) return;

    // 1. Construct Bitmask
    // Up: 1, Down: 2, Left: 4, Right: 8, Shoot: 16
    let mask = 0;
    if (this.keys.w || this.keys.ArrowUp) mask |= 1;
    if (this.keys.s || this.keys.ArrowDown) mask |= 2;
    if (this.keys.a || this.keys.ArrowLeft) mask |= 4;
    if (this.keys.d || this.keys.ArrowRight) mask |= 8;
    if (this.isShooting) mask |= 16;

    // 2. Create Packet (3 Bytes)
    const buffer = new ArrayBuffer(3);
    const view = new DataView(buffer);

    view.setUint8(0, PacketType.INPUT);       // OpCode
    view.setUint8(1, mask);                   // Mask
    view.setUint8(2, compressRotation(this.mouseAngle)); // Angle

    this.socket.send(buffer);
  }
}
