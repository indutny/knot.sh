import { Frontend as Screen } from '../screen';

import { View, ViewEvent } from './base';

export class Prompt extends View {
  private onValue: undefined | ((err?: Error) => void);
  private value: string = '';

  constructor(private readonly title: string) {
    super();
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

  // View-specific methods

  public addChild(_: View) {
    throw new Error('Prompt can\'t be a parent view');
  }

  public onEvent(event: ViewEvent) {
    if (!this.onValue) {
      throw new Error('Prompt must be presented right after adding to view');
    }

    if (event.name === 'write') {
      this.value += event.value;
    } else if (event.name === 'backspace') {
      this.value = this.value.slice(0, -1);
    } else if (event.name === 'newline') {
      this.onValue();
      return false;
    } else if (event.name === '^C' || event.name === '^D') {
      this.onValue(new Error(`Interrupted by user with: ${event.name}`));

      // No redraw needed
      return false;
    } else {
      // Ignore
      super.onEvent(event);
      return false;
    }

    // Re-draw
    return true;
  }

  public render(screen: Screen) {
    const toDisplay = this.title + this.value;
    screen.write(0, 0, toDisplay);
    screen.clearRight(toDisplay.length, 0);

    super.render(screen);
  }
}
