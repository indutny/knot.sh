import { Writable } from 'stream';

import { ANSIChar } from '../ansi-reader';
import { View, ViewEvent, ICursorDelta } from './base';

// TODO(indutny): move this to constants or make it configurable
const INDENT = '  ';

export class Window extends View {
  public receiveANSI(ch: ANSIChar, output: Writable): boolean {
    let event: ViewEvent;
    if (ch.type === 'char') {
      event = { name: 'write', value: ch.value };
    } else if (ch.type === 'special') {
      const name = ch.name;
      if (name === 'TAB') {
        event = { name: 'write', value: INDENT };
      } else if (name === 'DEL') {
        event = { name: 'backspace' };
      } else if (name === 'CR') {
        event = { name: 'newline' };
      } else if (name === '^C') {
        event = { name: '^C' };
      } else if (name === '^D') {
        event = { name: '^D' };
      } else {
        // Ignore
        return false;
      }
    } else if (ch.type === 'csi') {
      const name = ch.name;
      const param = parseInt(ch.params[ch.params.length - 1], 10) | 0;

      let delta: ICursorDelta;
      if (name === 'CUU') {
        delta = { row: -param };
      } else if (name === 'CUD') {
        delta = { row: param };
      } else if (name === 'CUF') {
        delta = { column: param };
      } else if (name === 'CUB') {
        delta = { column: -param };
      } else if (name === 'CNL') {
        delta = { row: param };
      } else if (name === 'CPL') {
        delta = { row: -param };
      } else {
        // Ignore
        return false;
      }
      event = { name: 'cursor-move', delta };
    } else {
      throw new Error(`Unexpected event type`);
    }

    // Changes in either of children chain
    if (this.onEvent(event)) {
      this.draw(output);
      return true;
    }
    return false;
  }

  public draw(output: Writable) {
    output.write(this.render());
  }

  public render() {
    // Clear screen and reset cursor
    return '\x1b[2J' + '\x1b[H' + super.render();
  }
}
