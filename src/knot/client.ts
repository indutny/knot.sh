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
      this.connection.end();
    });

    this.connection.once('close', () => {
      this.emit('close');
    });

    this.connection.once('ready', () => this.onReady());
  }

  private onReady() {
    this.connection.on('session', (accept, reject) => {
      console.log(`[${this.username}] session start`);

      const session = accept();

      session.on('pty', (accept, reject, info) => {
        console.log(`[${this.username}] pty start`);
        accept();
      });

      session.on('shell', (accept, reject) => {
        console.log(`[${this.username}] shell start`);
        this.onShell(accept());
      });
    });
  }

  private onShell(channel: ssh2.ServerChannel) {
  }
}
