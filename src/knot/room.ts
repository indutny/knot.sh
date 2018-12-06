import * as ssh2 from 'ssh2';

export class Room {
  constructor(public readonly name: string) {
  }

  public async join(username: string, channel: ssh2.ServerChannel) {
    channel.end();
  }
}
