import * as ssh2 from 'ssh2';

import { ANSIChar } from './ansi-reader';

const CLEAR_SCREEN = '\x1b[2J';

interface ICursor {
  readonly column: number;
  readonly row: number;
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

    console.log('here');
    for await (const ch of ansi) {
      console.log('there', ch);
      if (ch.type === 'special') {
        const name = ch.name;
        if (name === '^C' || name === '^D') {
          throw new Error(`Got ${name}`);
        }
      }
    }
  }
}
