import * as ssh2 from 'ssh2';

export class Cursor {
  private privColumn: number = 0;
  private privRow: number = 0;

  constructor(private readonly channel: ssh2.ServerChannel) {
  }

  public get column() {
    return this.privColumn;
  }

  public set column(value) {
    this.privColumn = value;
    this.redraw();
  }

  public get row() {
    return this.privRow;
  }

  public set row(value) {
    this.privRow = value;
    this.redraw();
  }

  public redraw() {
    this.channel.write(`\x1b[${this.privRow + 1};${this.privColumn + 1}H`);
  }
}
