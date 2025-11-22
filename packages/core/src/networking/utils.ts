// Map Size Reference (Should ideally come from config, but hardcoded for the utility context)
const MAP_HALF_WIDTH = 5000; 
const MAP_HALF_HEIGHT = 5000;

/**
 * Compresses a float position (-5000 to 5000) into a signed 16-bit integer.
 * Precision loss: ~0.15 units.
 */
export function compressPosition(value: number): number {
  // Clamp to bounds
  if (value < -MAP_HALF_WIDTH) value = -MAP_HALF_WIDTH;
  if (value > MAP_HALF_WIDTH) value = MAP_HALF_WIDTH;
  
  // Map [-5000, 5000] -> [-32767, 32767]
  // Formula: val * (32767 / 5000)
  return (value * 6.55) | 0; // Bitwise OR 0 allows fast float truncation
}

export function decompressPosition(value: number): number {
  return value / 6.55;
}

/**
 * Compresses rotation (-PI to PI) into 0-255 (Uint8)
 */
export function compressRotation(radians: number): number {
  // Normalize to 0 -> 2PI
  let angle = radians % (Math.PI * 2);
  if (angle < 0) angle += Math.PI * 2;
  
  // Map 0->2PI to 0->255
  return (angle / (Math.PI * 2) * 255) | 0;
}

export function decompressRotation(byte: number): number {
  // Map 0->255 to 0->2PI
  return (byte / 255) * (Math.PI * 2);
}
