import { Editor as EditorModel } from '../model';
import { Frontend as Screen } from '../screen';

import { View, ViewEvent } from './base';

interface ICursor {
  column: number;
  row: number;
}

export class Editor extends View {
  public readonly offset: ICursor = { column: 0, row: 0 };
  private onExit: undefined | ((err?: Error) => void);
  private cursor: ICursor = { column: 0, row: 0 };

  constructor(public readonly model: EditorModel) {
    super();
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

    if (event.name === 'write') {
      this.model.insert(event.value, this.cursor.column, this.cursor.row);
      this.cursor.column += event.value.length;
    } else if (event.name === 'newline') {
      this.model.insertNewline(this.cursor.column, this.cursor.row);
      this.cursor.row++;
      this.cursor.column = 0;
    } else if (event.name === 'backspace') {
      if (this.cursor.column === 0) {
        this.cursor.column = this.model.removeNewline(this.cursor.row);
        this.cursor.row--;
      } else {
        this.cursor.column -= 1;
        this.model.remove(1, this.cursor.column, this.cursor.row);
      }
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

    this.cursor.row = Math.max(0, this.cursor.row);
    this.cursor.row = Math.min(this.model.lines.length - 1, this.cursor.row);

    const line = this.model.lines[this.cursor.row];
    this.cursor.column = Math.max(0, this.cursor.column);
    this.cursor.column = Math.min(line.length - 1, this.cursor.column);

    super.onEvent(event);
    return changed;
  }

  public render(screen: Screen) {
    const lines = this.model.crop(Object.assign({
      width: screen.width,
      height: screen.height,
    }, this.offset));

    for (const [ row, line ] of lines.entries()) {
      screen.write(0, row, line);
      screen.clearRight(line.length, row);
    }

    // Display current position
    screen.setCursor(this.cursor.column, this.cursor.row);

    super.render(screen);
  }
}
