import { IViewFrame, View, ViewEvent } from './base';
import { EditorController } from '../controller';

interface ICursor {
  column: number;
  row: number;
}

export class Editor extends View {
  public readonly visibleFrame: IViewFrame;
  private onExit: undefined | ((err?: Error) => void);
  private cursor: ICursor = { column: 0, row: 0 };

  constructor(public readonly controller: EditorController) {
    super();

    this.visibleFrame = this.frame;
  }

  public awaitExit(): Promise<void> {
    return new Promise((resolve, reject) => {
      let complete = false;
      this.onExit = (err) => {
        if (complete) {
          return;
        }
        complete = true;

        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };
    });
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
      this.controller.insert(event.value, this.cursor.column, this.cursor.row);
      this.cursor.column += event.value.length;
    } else if (event.name === 'newline') {
      this.cursor.row++;
      this.cursor.column = 0;
    } else if (event.name === 'backspace') {
      this.controller.remove(1, this.cursor.column, this.cursor.row);
      this.cursor.column -= 1;
    } else if (event.name === '^C') {
      this.onExit!();
    } else if (event.name === 'cursor-move') {
      if (event.delta.row) {
        this.cursor.row += event.delta.row;
      }
      if (event.delta.column) {
        this.cursor.column += event.delta.column;
      }
    } else {
      changed = false;
    }

    super.onEvent(event);
    return changed;
  }

  public render() {
    const lines = this.controller.crop(this.visibleFrame);

    const moveCursor = (row: number) => {
      return `\x1b[${this.frame.row + row + 1};${this.frame.column + 1}H`;
    };

    let res = '';
    for (const [ row, line ] of lines.entries()) {
      res += moveCursor(row);
      res += line;
    }

    // Display current position
    res += `\x1b[${this.cursor.row + 1};${this.cursor.column + 1}H`;

    return res + super.render();
  }
}
