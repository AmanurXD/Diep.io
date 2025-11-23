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


  // Bound Event Handlers (Stored to allow removal)
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;
  private handleMouseMove: (e: MouseEvent) => void;
  private handleMouseDown: () => void;
  private handleMouseUp: () => void;


  constructor(socket: WebSocket, canvas: HTMLCanvasElement) {
    this.socket = socket;
    this.canvas = canvas;

    // Bind methods once
    this.handleKeyDown = (e) => this.onKeyDown(e);
    this.handleKeyUp = (e) => this.onKeyUp(e);
    this.handleMouseMove = (e) => this.onMouseMove(e);
    this.handleMouseDown = () => { this.isShooting = true; };
    this.handleMouseUp = () => { this.isShooting = false; };

    this.setupListeners();
    this.startTransmission();
  }

  private setupListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
  }


  public destroy() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }



  private onKeyDown(e: KeyboardEvent) {
    if (this.keys.hasOwnProperty(e.key)) {
      (this.keys as any)[e.key] = true;
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    if (this.keys.hasOwnProperty(e.key)) {
      (this.keys as any)[e.key] = false;
    }
  }

  private onMouseMove(e: MouseEvent) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    this.mouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
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
