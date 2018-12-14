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

    const off = row * this.privHeight + column;
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

    const off = row * this.privHeight + column;
    for (let i = 0; i < count; i++) {
      if (this.screen[off + i] === value) {
        continue;
      }
      this.screen[off + i] = value;
      this.changed[off + i] = true;
    }
  }

  public setCursor(row: number, column: number) {
    this.cursor.row = row;
    this.cursor.column = column;
  }
}
