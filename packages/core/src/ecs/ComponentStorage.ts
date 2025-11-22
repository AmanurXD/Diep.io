import { MAX_ENTITIES } from './constants';

// Allow Float32, Uint8, Int16, etc.
export type TypedArray = 
  | Float32Array 
  | Float64Array 
  | Int8Array 
  | Uint8Array 
  | Int16Array 
  | Uint16Array 
  | Int32Array 
  | Uint32Array;

type TypedArrayConstructor = {
  new (length: number): TypedArray;
};

export class ComponentStorage<T extends TypedArray> {
  // Publicly exposed for O(1) access in tight loops
  public data: T;

  constructor(ArrayType: TypedArrayConstructor) {
    this.data = new ArrayType(MAX_ENTITIES) as T;
  }

  /**
   * Zeroes out the data for a specific entity.
   * Crucial when recycling IDs to prevent "ghost" data.
   */
  public reset(entityId: number): void {
    this.data[entityId] = 0;
  }
  
  // For bulk clearing (e.g. map restart)
  public clearAll(): void {
    this.data.fill(0);
  }
}