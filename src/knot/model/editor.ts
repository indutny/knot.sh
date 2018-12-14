export interface ICropFrame {
  readonly column: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}

export class Editor {
  private listeners: Array<() => void> = [];

  constructor(private privLines: string[] = [ '' ]) {
    // Ensure non-empty text
    if (this.privLines.length === 0) {
      this.privLines.push('');
    }
  }

  public async awaitChange() {
    return new Promise((resolve) => {
      this.listeners.push(resolve);
    });
  }

  public get lines(): ReadonlyArray<string> {
    return this.privLines;
  }

  public insert(value: string, column: number, row: number) {
    // Pad rows as needed
    while (this.privLines.length <= row) {
      this.privLines.push('');
    }

    // Pad line as needed
    let line = this.privLines[row];
    while (line.length <= column) {
      line += ' ';
    }

    // Insert text
    line = line.slice(0, column) + value + line.slice(column);

    // Update line
    this.privLines[row] = line;

    this.emitChanges();
  }

  public insertNewline(column: number, row: number) {
    // Out-of-bounds
    if (row >= this.privLines.length) {
      return;
    }

    const line = this.privLines[row];

    this.privLines.splice(row, 1, line.slice(0, column), line.slice(column));
    this.emitChanges();
  }

  public remove(count: number, column: number, row: number) {
    // Out-of-bounds
    if (row >= this.privLines.length) {
      return;
    }

    const line = this.privLines[row];
    this.privLines[row] = line.slice(0, column) + line.slice(column + count);

    this.emitChanges();
  }

  public removeNewline(row: number): number {
    // Out-of-bounds
    if (row <= 0 || row >= this.privLines.length) {
      return 0;
    }

    const prev = this.privLines[row - 1];
    const current = this.privLines[row];

    this.privLines[row - 1] += current;
    this.privLines.splice(row, 1);

    this.emitChanges();

    return prev.length;
  }

  public crop(frame: ICropFrame): ReadonlyArray<string> {
    const maxRow = Math.min(frame.row + frame.height, this.privLines.length);

    const res: string[] = [];

    let i;
    for (i = frame.row; i < maxRow; i++) {
      const line = this.privLines[i];
      const part = line.slice(frame.column, frame.column + frame.width);

      res.push(part);
    }

    // Pad result
    while (res.length < frame.height) {
      res.push('');
    }

    return res;
  }

  private emitChanges() {
    const listeners = this.listeners;
    this.listeners = [];
    for (const listener of listeners) {
      listener();
    }
  }
}
