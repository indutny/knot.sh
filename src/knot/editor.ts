import { Buffer } from 'buffer';
import * as ssh2 from 'ssh2';

import { IViewFrame, View } from './view';

interface ICursorPos {
  column: number;
  row: number;
}

export interface ICursorDelta {
  readonly column?: number;
  readonly row?: number;
}

export class Editor {
  private readonly cursor: ICursorPos = { row: 0, column: 0 };

  constructor(private readonly username: string,
              private readonly channel: ssh2.ServerChannel,
              private readonly view: View) {
  }

  public moveCursor(delta: ICursorDelta) {
    if (delta.column !== undefined) {
      this.cursor.column += delta.column;
    }
    if (delta.row !== undefined) {
      this.cursor.row += delta.row;
    }
    this.redrawCursor();
  }

  public resize() {
  }

  public write(value: string) {
  }

  public newLine() {
  }

  public backspace() {
  }

  // Private

  private redrawCursor() {
    this.channel.write(
      `\x1b[${this.cursor.row + 1};${this.cursor.column + 1}H`);
  }
}
