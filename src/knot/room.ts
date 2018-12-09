import { Buffer } from 'buffer';
import * as ssh2 from 'ssh2';

import { ANSIChar } from './ansi-reader';

const CLEAR_SCREEN = '\x1b[2J';

const MAX_COLUMN = 80;
const MAX_ROW = 40;

interface ICursor {
  column: number;
  row: number;
}

export class Room {
  public content: string = '';
  public cursors: Map<string, ICursor> = new Map();

  constructor(public readonly name: string) {
  }

  public async join(username: string, channel: ssh2.ServerChannel,
                    ansi: AsyncIterableIterator<ANSIChar>) {
    const cursor: ICursor = { column: 0, row: 0 };

    this.cursors.set(username, cursor);

    channel.write(CLEAR_SCREEN);
    channel.write('\x1b[H');

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
        let delta: ICursor;
        if (name === 'CUU') {
          delta = { column: 0, row: -param };
        } else if (name === 'CUD') {
          delta = { column: 0, row: param };
        } else if (name === 'CUF') {
          delta = { column: param, row: 0 };
        } else if (name === 'CUB') {
          delta = { column: -param, row: 0 };
        } else {
          // Ignore
          continue;
        }

        this.updateCursor(cursor, delta);
        channel.write(`\x1b[${cursor.row + 1};${cursor.column + 1}H`);
      } else {
        channel.write(Buffer.from([ ch.code ]));

        this.updateCursor(cursor, { column: 1, row: 0 });
        channel.write(`\x1b[${cursor.row + 1};${cursor.column + 1}H`);
      }
    }
  }

  private updateCursor(cursor: ICursor, delta: ICursor) {
    cursor.row = Math.max(0, Math.min(MAX_ROW, cursor.row + delta.row));
    cursor.column = Math.max(0, Math.min(MAX_COLUMN, 
      cursor.column + delta.column));
  }
}
