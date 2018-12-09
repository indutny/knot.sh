import { Buffer } from 'buffer';
import * as ssh2 from 'ssh2';

import { ANSIChar } from './ansi-reader';

const CLEAR_SCREEN = '\x1b[2J';

import { Cursor } from './cursor';

export class Room {
  public content: string = '';
  public cursors: Map<string, Cursor> = new Map();

  constructor(public readonly name: string) {
  }

  public async join(username: string, channel: ssh2.ServerChannel,
                    ansi: AsyncIterableIterator<ANSIChar>) {
    const cursor = new Cursor(channel);

    this.cursors.set(username, cursor);

    channel.write(CLEAR_SCREEN);
    cursor.redraw();

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
        }
      } else if (ch.type === 'csi') {
        const name = ch.name;

        const param = parseInt(ch.params[ch.params.length - 1], 10) | 0;
        if (name === 'CUU') {
          cursor.row -= param;
        } else if (name === 'CUD') {
          cursor.row += param;
        } else if (name === 'CUF') {
          cursor.column += param;
        } else if (name === 'CUB') {
          cursor.column -= param;
        } else {
          // Ignore
          continue;
        }
      } else {
        channel.write(Buffer.from([ ch.code ]));

        cursor.column++;
      }
    }
  }
}
