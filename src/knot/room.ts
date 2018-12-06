import * as ssh2 from 'ssh2';

interface ICursor {
  readonly column: number;
  readonly row: number;
}

export class Room {
  public content: string = '';

  constructor(public readonly name: string) {
  }

  public async join(username: string, channel: ssh2.ServerChannel) {
    const cursor: ICursor = { column: 0, row: 0 };

    channel.end();
  }
}
