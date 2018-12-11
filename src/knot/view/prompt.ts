import { Writable } from 'stream';

import { View, ViewEvent } from './base';

class Prompt extends View {
  private onValue: undefined | (Error?) => void;
  private value: string = '';

  constructor(output: Writable, frame: IViewFrame,
              private readonly title: string) {
    super(output, frame);
  }

  public present(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.onValue) {
        return reject(new Error('This prompt was already presented.'));
      }

      let complete = false;

      this.onValue = (err) => {
        if (complete) {
          return;
        }
        complete = true;

        if (err) {
          return reject(err);
        }

        const value = this.value;
        this.value = '';
        resolve(value);
      };
    });
  }

  // Events

  public onEvent(event: ViewEvent) {
    if (event.name === 'write') {
      this.value += event.value;
    } else if (event.name === 'backspace') {
      this.value = this.value.slice(0, -1);
    } else if (event.name === 'newline') {
      this.onValue();
    } else if (event.name === '^C' || event.name === '^D') {
      this.onValue(new Error(`Interrupted by user with: ${event.name}`));

      // No redraw needed
      return;
    } else {
      // Ignore
      return;
    }

    this.draw();
  }

  public draw() {
    const frame = this.frame;

    let res = '';
    res += `\x1b[${frame.row + 1};${frame.column + 1}H`;

    res += this.title + this.value;

    this.output.write(res);
  }
}
