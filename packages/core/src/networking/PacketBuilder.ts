import { World } from '../ecs/World';
import { MAX_ENTITIES } from '../ecs/constants';
import { PacketType } from '../ecs/Types';
import { compressPosition, compressRotation } from './utils';

const BYTES_PER_ENTITY = 9; // Increased from 8 to 9
// Header: OpCode (1) + Count (2) = 3 bytes
const HEADER_SIZE = 3; 
// 16KB Buffer (Approx 2000 entities max per packet)
const BUFFER_SIZE = 16 * 1024; 

export class PacketBuilder {
  private buffer: ArrayBuffer;
  private view: DataView;

  constructor() {
    this.buffer = new ArrayBuffer(BUFFER_SIZE);
    this.view = new DataView(this.buffer);
  }

  /**
   * Serializes the current World state into a binary packet.
   * Format: [OpCode (1)] [Count (2)] [ [ID(2) Type(1) X(2) Y(2) Rot(1)] ... ]
   */
  public createUpdatePacket(world: World): DataView {
    let offset = 0;

    // 1. Write OpCode
    this.view.setUint8(offset, PacketType.UPDATE);
    offset += 1;

    // 2. Placeholder for Entity Count (will overwrite later)
    const countOffset = offset;
    offset += 2; // Advance past the placeholder

    // 3. Iterate and Write Entities
    let entityCount = 0;
    const active = world.active.data;

    // Direct access to arrays for speed
    const x = world.x.data;
    const y = world.y.data;
    const rot = world.rotation.data;
    const type = world.type.data;

    for (let i = 0; i < MAX_ENTITIES; i++) {
      if (active[i] === 0) continue;

      // Check buffer overflow safety
      if (offset + BYTES_PER_ENTITY > BUFFER_SIZE) {
        console.warn("Packet buffer overflow! Some entities skipped.");
        break;
      }

      // --- Write Entity Data ---
      
      // ID (Uint16)
      this.view.setUint16(offset, i, true); // Little Endian
      offset += 2;

      // Rotation (Uint8)
      this.view.setUint8(offset, compressRotation(rot[i]));
      offset += 1;

      // NEW: Health (Uint8) -> Percentage 0-255
      const hp = world.health.data[i];
      const max = world.maxHealth.data[i];
      let hpByte = 0;
      
      if (max > 0) {
        // Calculate percentage
        const percent = Math.max(0, Math.min(1, hp / max));
        hpByte = Math.floor(percent * 255);
      }
      
      this.view.setUint8(offset, hpByte);
      offset += 1;

      // X (Int16)
      this.view.setInt16(offset, compressPosition(x[i]), true);
      offset += 2;

      // Y (Int16)
      this.view.setInt16(offset, compressPosition(y[i]), true);
      offset += 2;

      // Rotation (Uint8)
      this.view.setUint8(offset, compressRotation(rot[i]));
      offset += 1;

      entityCount++;
    }

    // 4. Write Actual Entity Count back at the header
    this.view.setUint16(countOffset, entityCount, true);

    // Return a view of ONLY the used portion of the buffer
    return new DataView(this.buffer, 0, offset);
  }
}
