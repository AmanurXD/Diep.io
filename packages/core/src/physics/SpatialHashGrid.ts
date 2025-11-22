import { MAX_ENTITIES } from '../ecs/constants';

export class SpatialHashGrid {
  private cellSize: number;
  private cols: number;
  private rows: number;
  
  // "Heads": Map cell index -> First Entity ID in that cell
  // Value is entity ID, or -1 if empty
  private cellHead: Int32Array;

  // "Links": Map Entity ID -> Next Entity ID in the same cell
  // Value is entity ID, or -1 if end of chain
  private nextEntity: Int32Array;
  
  // Query Buffer: A reusable array to store query results to avoid GC
  // Assuming we rarely need to collide with more than 1000 things at once
  public queryResults: Int32Array; 
  public queryCount: number = 0;

  constructor(width: number, height: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);

    const totalCells = this.cols * this.rows;

    this.cellHead = new Int32Array(totalCells).fill(-1);
    this.nextEntity = new Int32Array(MAX_ENTITIES).fill(-1);
    this.queryResults = new Int32Array(MAX_ENTITIES); // Reusable buffer
  }

  /**
   * Clears the grid. Must be called at the start of every frame.
   * Complexity: O(C) where C is number of cells (very fast).
   */
  public clear(): void {
    this.cellHead.fill(-1);
    // We don't need to clear nextEntity, as it gets overwritten on insert
  }

  /**
   * Inserts an entity into the grid based on its center position.
   * Complexity: O(1)
   */
  public insert(id: number, x: number, y: number): void {
    // 1. Calculate Cell Index
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);

    // Bounds check (ignore if outside map)
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return;
    }

    const cellIndex = row * this.cols + col;

    // 2. Linked List Insertion
    // Point this entity's "next" to whatever was currently at the head
    this.nextEntity[id] = this.cellHead[cellIndex];
    
    // Make this entity the new head of the cell
    this.cellHead[cellIndex] = id;
  }

  /**
   * populates this.queryResults with all entity IDs in the cells 
   * surrounding the given area.
   * Returns the count of found entities.
   */
  public query(x: number, y: number, radius: number): number {
    this.queryCount = 0;

    // Determine range of cells to check
    // We check the min/max bounds of the object's radius
    const startCol = Math.floor((x - radius) / this.cellSize);
    const endCol = Math.floor((x + radius) / this.cellSize);
    const startRow = Math.floor((y - radius) / this.cellSize);
    const endRow = Math.floor((y + radius) / this.cellSize);

    // Clamp to grid size
    const minCol = Math.max(0, startCol);
    const maxCol = Math.min(this.cols - 1, endCol);
    const minRow = Math.max(0, startRow);
    const maxRow = Math.min(this.rows - 1, endRow);

    // Iterate through the relevant cells
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cellIndex = r * this.cols + c;
        
        // Traverse the linked list for this cell
        let currentId = this.cellHead[cellIndex];
        
        while (currentId !== -1) {
          // Add to results
          this.queryResults[this.queryCount++] = currentId;
          
          // Move to next entity in this cell
          currentId = this.nextEntity[currentId];
        }
      }
    }

    return this.queryCount;
  }
}
