import { PacketType } from '../ecs/Types';
import { decompressPosition, decompressRotation } from './utils';

export interface EntitySnapshot {
  id: number;
  type: number;
  x: number;
  y: number;
  rotation: number;
  health: number; // 0-255
}

export class PacketParser {
  // Reusable pool/array could be implemented here to reduce GC on the client
  // For this phase, we will return a fresh array for simplicity.
  
  public parseUpdatePacket(buffer: ArrayBuffer): EntitySnapshot[] | null {
    const view = new DataView(buffer);
    let offset = 0;

    // 1. Read OpCode
    const opCode = view.getUint8(offset);
    offset += 1;

    if (opCode !== PacketType.UPDATE) return null;

    // 2. Read Count
    const count = view.getUint16(offset, true);
    offset += 2;

    const snapshots: EntitySnapshot[] = [];

    // 3. Read Entities
    for (let i = 0; i < count; i++) {
      const id = view.getUint16(offset, true);
      offset += 2;

      const type = view.getUint8(offset);
      offset += 1;

      const xRaw = view.getInt16(offset, true);
      offset += 2;

      const yRaw = view.getInt16(offset, true);
      offset += 2;

      const rotRaw = view.getUint8(offset);
      offset += 1;

      // NEW: Read Health
      const hpRaw = view.getUint8(offset);
      offset += 1;

      snapshots.push({
        id,
        type,
        x: decompressPosition(xRaw),
        y: decompressPosition(yRaw),
        rotation: decompressRotation(rotRaw),
        health: hpRaw // Store raw byte (0-255)
      });
    }

    return snapshots;
  }
}
