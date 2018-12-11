import { Writable } from 'stream';

import { IViewFrame, View, ViewEvent } from './base';
import { EditorController } from '../controller';

export class Editor extends View {
  public readonly visibleFrame: IViewFrame;

  constructor(public readonly controller: EditorController) {
    super();

    this.visibleFrame = this.frame;
  }

  // View-specific methods

  public addChild(_: View) {
    throw new Error('Prompt can\'t be a parent view');
  }

  public onEvent(event: ViewEvent) {
    let changed = true;

    // Keep being full-screen
    if (event.name === 'resize') {
      this.frame.row = 0;
      this.frame.column = 0;
      this.frame.width = event.size.width;
      this.frame.height = event.size.height;
    } else if (event.name === 'write') {
      // TODO(indutny): implement me
    } else if (event.name === 'newline') {
      // TODO(indutny): implement me
    } else if (event.name === 'backspace') {
      // TODO(indutny): implement me
    } else if (event.name === '^C') {
      // TODO(indutny): implement me
    } else if (event.name === 'cursor-move') {
      // TODO(indutny): implement me
    } else {
      changed = false;
    }

    super.onEvent(event);
    return changed;
  }

  public draw(output: Writable) {
    const lines = this.controller.crop(this.visibleFrame);

    const moveCursor = (row: number) => {
      return `\x1b[${this.frame.row + row + 1};${this.frame.column + 1}H`;
    };

    let res = '';
    for (const [ row, line ] of lines.entries()) {
      res += moveCursor(row);
      res += line;
    }

    output.write(res);

    super.draw(output);
  }
}
