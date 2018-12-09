import { Writable } from 'stream';

const CLEAR_SCREEN = '\x1b[2J';
const RESET_CURSOR = '\x1b[H';

export class Text {
  private readonly privLines: string[] = [];

  constructor(private readonly output: Writable) {
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

  public draw(column: number, row: number, width: number, height: number) {
    let res = CLEAR_SCREEN + RESET_CURSOR;

    let i: number;
    for (i = row; i < Math.min(this.privLines.length, row + height); i++) {
      const line = this.privLines[i];

      res += line.slice(column, column + width) + '|\r\n';
    }

    for (; i < row + height; i++) {
      res += ' '.repeat(width) + '|\r\n';
    }

    res += '-'.repeat(width - 1) + '+';

    this.output.write(res);
  }
}
