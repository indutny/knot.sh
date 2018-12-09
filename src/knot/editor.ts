import { Buffer } from 'buffer';
import * as ssh2 from 'ssh2';

const CLEAR_SCREEN = '\x1b[2J';

export class Editor {
  private privColumn: number = 0;
  private privRow: number = 0;

  constructor(private readonly channel: ssh2.ServerChannel) {
  }

  public get column() {
    return this.privColumn;
  }

  public set column(value) {
    this.privColumn = value;
    this.redrawCursor();
  }

  public get row() {
    return this.privRow;
  }

  public set row(value) {
    this.privRow = value;
    this.redrawCursor();
  }

  public clearScreen() {
    this.channel.write(CLEAR_SCREEN);
  }

  public redrawCursor() {
    this.channel.write(`\x1b[${this.privRow + 1};${this.privColumn + 1}H`);
  }

  public write(code: number) {
    this.channel.write(Buffer.from([ code ]));
    this.column++;
  }
}
