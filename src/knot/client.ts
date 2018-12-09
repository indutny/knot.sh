import { EventEmitter } from 'events';
import * as debugAPI from 'debug';
import { Buffer } from 'buffer';
import * as ssh2 from 'ssh2';

import { ANSIChar, ANSIReader } from './ansi-reader';
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

      const size: IWindowSize = { columns: 0, rows: 0 };

      session.once('pty', (accept, reject, info) => {
        this.debug(`pty start`);

        size.columns = info.cols;
        size.rows = info.rows;

        accept();
      });

      const onWindowChange = (accept, reject, info) => {
        if (accept) {
          accept();
        }

        size.columns = info.cols;
        size.rows = info.rows;
      };
      session.on('window-change', onWindowChange);

      session.once('shell', (accept, reject) => {
        this.debug(`shell start`);
        const shell = accept() as ssh2.ServerChannel;

        session.removeListener('window-change', onWindowChange);

        this.onShell(session, shell, size).catch((e) => {
          this.debug(`shell error "${e.stack}"`);
          shell.stderr.write(`\r\n${e.message}\r\n`);
          this.connection.end();
        });
      });
    });
  }

  private async onShell(session: ssh2.Session,
                        channel: ssh2.ServerChannel,
                        initialSize: IWindowSize) {
    channel.allowHalfOpen = false;

    channel.stdin.pipe(this.ansiReader);

    const roomName = await this.prompt(channel, 'Please enter room id: ');
    this.debug(`got room "${roomName}"`);

    // TODO(indutny): fetch the room instance using `roomName`
    const room = new Room(roomName);

    await room.join(this.username, channel, this.ansiIterator);
  }

  private async prompt(channel: ssh2.ServerChannel, title: string) {
    const stdout = channel.stdout;

    let codes: number[] = [];

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
      } else if (ch.type === 'csi') {
        // TODO(indutny): support cursor?
        continue;
      }

      codes.push(ch.code);
      stdout.write(Buffer.from([ ch.code ]));
    }

    throw new Error('Unexpected');
  }
}
