import * as ssh2 from 'ssh2';

import { EditorController } from './controller';

export class Room {
  public readonly controller = new EditorController();

  constructor(public readonly name: string) {
  }

  public enter(username: string) {
  }

  public leave(username: string) {
  }
}
