export ICropFrame {
  readonly column: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}

export class TextController {
  constructor(private privLines: string[]) {
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

  public remove(column: number, row: number, count: number) {
    // Out-of-bounds
    if (row >= this.privLines.length) {
      return;
    }

    const line = this.privLines[row];
    this.privLines[row] = line.slice(0, column) + line.slice(column + count);
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

    while (res.length < frame.height) {
      res.push('');
    }

    return res;
  }
}
