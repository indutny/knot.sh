import { EventEmitter } from 'events';
import * as debugAPI from 'debug';
import { Buffer } from 'buffer';
import * as ssh2 from 'ssh2';

import { ANSIChar, ANSIReader } from './ansi-reader';
import { Editor, Prompt, Window } from './view';
import { Room } from './room';

const debugFn = debugAPI('knot:client');

export class Client extends EventEmitter {
  private readonly ansiReader = new ANSIReader();
  private readonly rooms: Map<string, Room> = new Map();
  private readonly window = new Window();

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

    // Join the room with a new editor
    const window = this.window;

    const prompt = new Prompt('Enter room id: ');
    window.addChild(prompt);
    window.draw(channel.stdout);

    await Promise.all([
      this.loop(channel),
      new Promise(async () => {
        const value = await prompt.present();
        window.removeChild(prompt);
        window.draw(channel.stdout);
      }),
    ]);
  }

  private async loop(channel: ssh2.ServerChannel) {
    for await (const ch of this.ansiReader) {
      this.window.receiveANSI(ch, channel.stdout);
    }
  }
}
