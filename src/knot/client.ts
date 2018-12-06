import { EventEmitter } from 'events';
import * as debugAPI from 'debug';
import * as ssh2 from 'ssh2';

const debug = debugAPI('knot:client');

export class Client extends EventEmitter {
  constructor(public readonly username: string,
              private readonly connection: ssh2.Connection) {
    super();

    this.connection.on('error', (err) => {
      debug(`[${this.username}] connection error: "${err.stack}"`);
    });

    this.connection.once('close', () => {
      debug(`[${this.username}] connection close`);
      this.emit('close');
    });

    this.connection.once('ready', () => this.onReady());
  }

  private onReady() {
    debug(`[${this.username}] ready`);

    this.connection.on('session', (accept, reject) => {
      debug(`[${this.username}] session start`);

      const session = accept();

      session.on('pty', (accept, reject, info) => {
        debug(`[${this.username}] pty start`);
        accept();
      });

      session.on('shell', (accept, reject) => {
        debug(`[${this.username}] shell start`);
        this.onShell(accept());
      });
    });
  }

  private onShell(channel: ssh2.ServerChannel) {
  }
}
