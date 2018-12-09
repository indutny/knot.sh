import { EventEmitter } from 'events';
import * as debugAPI from 'debug';
import { Buffer } from 'buffer';
import * as ssh2 from 'ssh2';

import { ANSIChar, ANSIReader } from './ansi-reader';
import { Editor } from './editor';
import { Room } from './room';

const debugFn = debugAPI('knot:client');

const ERASE_SEQ = Buffer.from('\b \b');
const CRLF_SEQ = Buffer.from('\r\n');

interface IWindowSize {
  readonly columns: number;
  readonly rows: number;
}

export class Client extends EventEmitter {
  private readonly ansiReader = new ANSIReader();
  private readonly ansiIterator: AsyncIterableIterator<ANSIChar> =
    this.ansiReader[Symbol.asyncIterator]();
  private readonly rooms: Map<string, Room> = new Map();

  constructor(public readonly username: string,
              private readonly connection: ssh2.Connection) {
    super();

    this.connection.on('error', (err) => {
      this.debug(`connection error: "${err.stack}"`);
    });

    this.connection.once('close', () => {
      this.debug(`connection close`);
      this.emit('close');
    });

    this.connection.once('ready', () => this.onReady());
  }

  private debug(str: string) {
    if (!debugFn.enabled) {
      return;
    }

    debugFn(`[${this.username}] ${str}`);
  }

  private onReady() {
    this.debug(`ready`);

    this.connection.on('session', (accept, reject) => {
      this.debug(`session start`);

      const session = accept();

      session.once('pty', (accept, reject, info) => {
        this.debug(`pty start`);

        accept();
      });

      session.once('shell', (accept, reject) => {
        this.debug(`shell start`);
        const shell = accept() as ssh2.ServerChannel;

        this.onShell(shell).catch((e) => {
          this.debug(`shell error "${e.stack}"`);
          shell.stderr.write(`\r\n${e.message}\r\n`);
          this.connection.end();
        });
      });
    });
  }

  private async onShell(channel: ssh2.ServerChannel) {
    channel.allowHalfOpen = false;
    channel.stdin.pipe(this.ansiReader);

    // Get the room name
    const roomName = await this.prompt(channel, 'Please enter room id: ');
    this.debug(`got room "${roomName}"`);

    // TODO(indutny): remove old rooms
    let room: Room;
    if (this.rooms.has(roomName)) {
      room = this.rooms.get(roomName)!;
    } else {
      room = new Room(roomName);
      this.rooms.set(roomName, room);
    }

    // Join the room with a new editor
    const editor = new Editor(this.username, channel, room.view);
    room.join(this.username);

    try {
      for (;;) {
        const result = await this.ansiIterator.next();
        if (result.done) {
          break;
        }

        const ch = result.value;
        if (ch.type === 'special') {
          const name = ch.name;
          if (name === '^C') {
            throw new Error(`Got ${name}`);
          }

          if (name === 'CR') {
            editor.newLine();
          } else if (name === 'DEL') {
            editor.backspace();
          }
        } else if (ch.type === 'csi') {
          const name = ch.name;
          const param = parseInt(ch.params[ch.params.length - 1], 10) | 0;

          if (name === 'CUU') {
            editor.moveCursor({ row: -param });
          } else if (name === 'CUD') {
            editor.moveCursor({ row: +param });
          } else if (name === 'CUF') {
            editor.moveCursor({ column: +param });
          } else if (name === 'CUB') {
            editor.moveCursor({ column: -param });
          }
        } else {
          editor.write(ch.value);
        }
      }
    } finally {
      room.leave(this.username);
      channel.end();
    }
  }

  private async prompt(channel: ssh2.ServerChannel, title: string)
      : Promise<string> {
    const stdout = channel.stdout;

    let value = '';

    stdout.write(title);

    for (;;) {
      const result = await this.ansiIterator.next();
      if (result.done) {
        throw new Error('Early end of stream');
      }

      const ch = result.value;
      if (ch.type === 'special') {
        const name = ch.name;
        if (name === '^C' || name === '^D') {
          throw new Error(`Got ${name}`);
        }

        if (name === 'CR') {
          // Enter
          stdout.write(CRLF_SEQ);
          return value;
        }

        if (name === 'DEL') {
          // Backspace
          if (value.length === 0) {
            continue;
          }

          stdout.write(ERASE_SEQ);
          value = value.slice(0, -1);
        }

        continue;
      } else if (ch.type === 'csi') {
        // TODO(indutny): support cursor?
        continue;
      }

      value += ch.value;
      stdout.write(ch.value);
    }

    throw new Error('Unexpected');
  }
}
