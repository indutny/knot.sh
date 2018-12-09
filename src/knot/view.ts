import { Writable } from 'stream';

const CLEAR_SCREEN = '\x1b[2J';
const RESET_CURSOR = '\x1b[H';

export interface IViewFrame {
  readonly column: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}

export class View {
  private readonly privLines: string[] = [];

  constructor() {
  }

  public get lines(): ReadonlyArray<string> {
    return this.privLines;
  }

  public insert(value: string, column: number, row: number) {
    while (this.privLines.length <= row) {
      this.privLines.push('');
    }

    let line = this.privLines[row];
    while (line.length <= column) {
      line += ' ';
    }

    line = line.slice(0, column) + value + line.slice(column);
    this.privLines[row] = line;
  }

  public draw(output: Writable, frame: IViewFrame) {
    let res = CLEAR_SCREEN + RESET_CURSOR;

    const row = frame.row;
    const endRow = row + frame.height;
    const column = frame.column;
    const endColumn = column + frame.width;

    let i: number;
    for (i = row; i < Math.min(this.privLines.length, endRow); i++) {
      const line = this.privLines[i];

      res += line.slice(column, endColumn) + '|\r\n';
    }

    for (; i < endRow; i++) {
      res += ' '.repeat(frame.width) + '|\r\n';
    }

    res += '-'.repeat(frame.width - 1) + '+';

    output.write(res);
  }
}
