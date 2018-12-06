import { EventEmitter } from 'events';
import * as debugAPI from 'debug';
import { Buffer } from 'buffer';
import * as ssh2 from 'ssh2';

const debugFn = debugAPI('knot:client');

const ERASE_SEQ = Buffer.from('\b \b');
const CRLF_SEQ = Buffer.from('\r\n');

export class Client extends EventEmitter {
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
    const room = await this.prompt(channel, 'Please enter room id: ');
    this.debug(`got room "${room}"`);
    channel.end();
  }

  private async prompt(channel: ssh2.ServerChannel, title: string) {
    const stdin = channel.stdin;
    const stdout = channel.stdout;

    let chunks: Buffer[] = [];

    stdout.write(title);

    return new Promise((resolve, reject) => {
      const onReadable = () => {
        for (;;) {
          const b = stdin.read(1);
          if (b === null) {
            break;
          }

          const code = b[0];
          if (code === 0x3 || code === 0x4) {
            // ^C, ^D
            stdin.removeListener('readable', onReadable);
            return reject(new Error(`Got ^${code === 0x3 ? 'C': 'D'}`));

          } else if (code === 0xd) {
            // Enter
            stdout.write(CRLF_SEQ);

            const input = Buffer.concat(chunks, chunks.length);
            stdin.removeListener('readable', onReadable);
            return resolve(input);

          } else if (code === 0x7f) {
            // Backspace
            if (chunks.length === 0) {
              continue;
            }

            stdout.write(ERASE_SEQ);
            chunks = chunks.slice(0, -1);
          } else if (code === 0x9 || code >= 0x20 && code < 0x7f) {
            // Tab or printable chars
            chunks.push(b);
            stdout.write(b);
          }
        }
      };
      stdin.on('readable', onReadable);
    });
  }
}
