import { Editor } from '../model';

export class Room {
  public readonly editor = new Editor();

  constructor(public readonly name: string) {
  }

  public enter(username: string) {
  }

  public leave(username: string) {
  }
}
