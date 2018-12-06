import { EventEmitter } from 'events';
import * as debugAPI from 'debug';
import { Buffer } from 'buffer';
import * as ssh2 from 'ssh2';

import { ANSIReader } from './ansi-reader';
import { Room } from './room';

const debugFn = debugAPI('knot:client');

const ERASE_SEQ = Buffer.from('\b \b');
const CRLF_SEQ = Buffer.from('\r\n');

export class Client extends EventEmitter {
  private readonly ansiReader = new ANSIReader();

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

      session.on('pty', (accept, reject, info) => {
        this.debug(`pty start`);
        accept();
      });

      session.on('shell', (accept, reject) => {
        this.debug(`shell start`);
        const shell = accept();
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

    const roomName = await this.prompt(channel, 'Please enter room id: ');
    this.debug(`got room "${roomName}"`);

    // TODO(indutny): fetch the room instance using `roomName`
    const room = new Room(roomName);

    await room.join(this.username, channel);
  }

  private async prompt(channel: ssh2.ServerChannel, title: string) {
    const stdout = channel.stdout;

    let codes: number[] = [];

    stdout.write(title);

    for await (const ch of this.ansiReader[Symbol.asyncIterator]()) {
      if (ch.type === 'special') {
        const name = ch.name;
        if (name === '^C' || name === '^D') {
          throw new Error(`Got ${name}`);
        }

        if (name === 'CR') {
          // Enter
          stdout.write(CRLF_SEQ);
          return Buffer.from(codes).toString();
        }

        if (name === 'DEL') {
          // Backspace
          if (codes.length === 0) {
            continue;
          }

          stdout.write(ERASE_SEQ);
          codes = codes.slice(0, -1);
        }

        continue;
      }

      codes.push(ch.code);
      stdout.write(Buffer.from([ ch.code ]));
    }

    throw new Error('Unexpected');
  }
}
