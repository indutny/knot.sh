import { Writable } from 'stream';

interface ICursor {
  row: number;
  column: number;
}

export class Backend {
  private readonly screen: string[];
  private readonly changed: boolean[];
  private readonly cursor: ICursor = { row: 0, column: 0 };

  constructor(private readonly stream: Writable,
              private privWidth: number,
              private privHeight: number) {
    // Clear screen and reset cursor
    this.stream.write('\x1b[H\x1b[2J');

    this.screen = new Array(privHeight * privWidth).fill(' ');
    this.changed = new Array(this.screen.length).fill(false);
  }

  public get width() {
    return this.privWidth;
  }

  public get height() {
    return this.privHeight;
  }

  public resize(width: number, height: number) {
    throw new Error('Not supported');
  }

  public write(column: number, row: number, value: string) {
    value = value.slice(0, this.privWidth - column);

    const off = row * this.privWidth + column;
    for (let i = 0; i < value.length; i++) {
      if (this.screen[off + i] === value[i]) {
        continue;
      }
      this.screen[off + i] = value[i];
      this.changed[off + i] = true;
    }
  }

  public fill(column: number, row: number, value: string, count: number) {
    if (value.length !== 1) {
      throw new Error('`value` must be a char');
    }

    count = Math.min(count, this.privWidth - column);

    const off = row * this.privWidth + column;
    for (let i = 0; i < count; i++) {
      if (this.screen[off + i] === value) {
        continue;
      }
      this.screen[off + i] = value;
      this.changed[off + i] = true;
    }
  }

  public setCursor(column: number, row: number) {
    this.cursor.row = row;
    this.cursor.column = column;
  }

  public send() {
    let res = '';

    const screen = this.screen;
    const changed = this.changed;

    const width = this.privWidth;
    const height = this.privHeight;

    for (let row = 0; row < height; row++) {
      const rowOff = row * width;

      let buffer = '';
      let startColumn = -1;
      for (let column = 0; column < width; column++) {
        const off = rowOff + column;

        if (!changed[off] && startColumn !== -1) {
          res += this.renderWrite(startColumn, row, buffer);
          startColumn = -1;
          buffer = '';
          continue;
        }

        if (!changed[off]) {
          continue;
        }

        if (startColumn === -1) {
          startColumn = column;
        }
        buffer += screen[off];
      }

      if (startColumn !== -1) {
        res += this.renderWrite(startColumn, row, buffer);
      }
    }
    changed.fill(false);

    // Update cursor position
    res += `\x1b[${this.cursor.row + 1};${this.cursor.column + 1}H`;

    this.stream.write(res);
  }

  private renderWrite(column: number, row: number, value: string) {
    return `\x1b[${row + 1};${column + 1}H` + value;
  }
}
