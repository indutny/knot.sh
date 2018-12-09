import * as ssh2 from 'ssh2';

import { ANSIChar } from './ansi-reader';
import { Editor } from './editor';

export class Room {
  public content: string = '';
  public editors: Map<string, Editor> = new Map();

  constructor(public readonly name: string) {
  }

  public async join(username: string, channel: ssh2.ServerChannel,
                    ansi: AsyncIterableIterator<ANSIChar>) {
    const editor = new Editor(channel);

    this.editors.set(username, editor);

    editor.clearScreen();
    editor.redrawCursor();

    for (;;) {
      const result = await ansi.next();
      if (result.done) {
        throw new Error('Early end of stream');
      }

      const ch = result.value;
      if (ch.type === 'special') {
        const name = ch.name;
        if (name === '^C' || name === '^D') {
          throw new Error(`Got ${name}`);
        } else if (name === 'CR') {
          editor.column = 0;
          editor.row++;
        }
      } else if (ch.type === 'csi') {
        const name = ch.name;

        const param = parseInt(ch.params[ch.params.length - 1], 10) | 0;
        if (name === 'CUU') {
          editor.row -= param;
        } else if (name === 'CUD') {
          editor.row += param;
        } else if (name === 'CUF') {
          editor.column += param;
        } else if (name === 'CUB') {
          editor.column -= param;
        } else {
          // Ignore
          continue;
        }
      } else {
        editor.write(ch.code);
      }
    }
  }
}
