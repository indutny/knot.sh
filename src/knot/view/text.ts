import { Writable } from 'stream';

import { IViewFrame, View } from './base';

const CLEAR_SCREEN = '\x1b[2J';

export class Text extends View {
  public readonly visibleFrame: IViewFrame;

  constructor(output: Writable, frame: IViewFrame,
              public readonly controller: TextController) {
    super(output, frame);

    this.visibleFrame = frame;
  }

  // View override

  public draw() {
    const lines = this.controller.crop(this.visibleFrame);

    const moveCursor = (row: number) => {
      return `\x1b[${this.frame.row + row + 1};${this.frame.column + 1}H`;
    };

    let res = CLEAR_SCREEN;
    for (const [ row, line ] of lines.entries()) {
      res += moveCursor(row);
      res += line;
    }

    this.output.write(res);
  }
}
