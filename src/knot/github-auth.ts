import { Buffer } from 'buffer';
import * as crypto from 'crypto';
import fetch from 'node-fetch';

const GITHUB_API = 'https://api.github.com';

export interface IGithubParams {
  readonly algorithm: string;
  readonly signatureAlgorithm: string;
  readonly nonce: Buffer;
  readonly signature: Buffer;
}

export class GithubAuth {
  constructor() {
  }

  public async verify(user: string, params: IGithubParams) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/i.test(user)) {
      throw new Error(`Invalid github username: "${user}"`);
    }

    // TODO(indutny): cache
    const res = await fetch(`${GITHUB_API}/users/${user}/keys`);
    const json = await res.json();

    console.log(json);
    return true;
  }
}
