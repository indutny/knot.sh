import { Buffer } from 'buffer';
import * as ssh2 from 'ssh2';
import * as debugAPI from 'debug';

import { Client } from './knot/client';
import { GithubAuth } from './knot/github-auth';
import { Room } from './knot/model/room';

const debug = debugAPI('knot');

export type HostKey = Buffer | string | ssh2.EncryptedPrivateKey;

export interface IKnotConfig {
  readonly hostKeys: HostKey[];
}

export class Knot extends ssh2.Server {
  private readonly githubAuth: GithubAuth = new GithubAuth();
  private readonly clients: Set<Client> = new Set();
  private readonly rooms: Map<string, Room> = new Map();

  constructor(private readonly config: IKnotConfig) {
    super({
      hostKeys: config.hostKeys,
      banner: 'Welcome to knot.sh',
      ident: 'knot.sh',
    });

    this.on('connection', (conn, info) => this.onConnection(conn, info));
  }

  private onConnection(connection: ssh2.Connection, info: ssh2.ClientInfo) {
    let done = false;

    connection.on('authentication', (ctx) => {
      if (ctx.method !== 'publickey') {
        return ctx.reject();
      }

      this.githubAuth.verify(ctx.username, {
        algorithm: ctx.key.algo,
        digest: ctx.sigAlgo,
        nonce: ctx.blob,
        signature: ctx.signature,
      }).then((result) => {
        if (!result) {
          debug('no appropriate key');
          return ctx.reject();
        }

        if (done) {
          debug('already authorized');
          return;
        }

        if (!ctx.signature) {
          // No signature, client is probing
          return ctx.accept();
        }

        done = true;
        debug(`successful login for "${ctx.username}"`);

        const client = new Client(ctx.username, this.rooms, connection);

        this.clients.add(client);

        client.once('close', () => {
          this.clients.delete(client);
        });

        ctx.accept();
      }).catch((e) => {
        debug(`auth error: ${e.stack}`);
        connection.end();
      });
    });
  }
}
