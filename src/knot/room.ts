import * as ssh2 from 'ssh2';

import { ANSIChar } from './ansi-reader';
import { View } from './view';

export class Room {
  public readonly view = new View();

  constructor(public readonly name: string) {
  }

  public join(username: string) {
  }

  public leave(username: string) {
  }
}
