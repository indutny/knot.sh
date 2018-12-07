import * as ssh2 from 'ssh2';

import { ANSIChar } from './ansi-reader';

const CLEAR_SCREEN = '\x1b[2J';

const MAX_COLUMN = 80;
const MAX_ROW = 60;

interface ICursor {
  column: number;
  row: number;
}

export class Room {
  public content: string = '';

  constructor(public readonly name: string) {
  }

  public async join(username: string, channel: ssh2.ServerChannel,
                    ansi: AsyncIterableIterator<ANSIChar>) {
    const cursor: ICursor = { column: 0, row: 0 };

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

        if (name === 'CUU') {
          cursor.row -= parseInt(ch.params[0], 10);
        } else if (name === 'CUD') {
          cursor.row += parseInt(ch.params[0], 10);
        } else if (name === 'CUF') {
          cursor.column += parseInt(ch.params[0], 10);
        } else if (name === 'CUB') {
          cursor.column -= parseInt(ch.params[0], 10);
        } else if (name === 'CUP') {
          const [ row, column ] = ch.params.map((x) => parseInt(x, 10));

          cursor.row = row;
          cursor.column = column;
        } else {
          continue;
        }

        cursor.row = Math.max(0, Math.min(MAX_ROW, cursor.row));
        cursor.column = Math.max(0, Math.min(MAX_ROW, cursor.column));

        channel.write(`\x1b[${cursor.row + 1};${cursor.column + 1}H`);
      } else {
      }
    }
  }
}
