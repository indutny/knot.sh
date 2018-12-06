import { Buffer } from 'buffer';
import * as crypto from 'crypto';
import * as debugAPI from 'debug';
import fetch from 'node-fetch';
import * as LRU from 'lru-cache';
import { parseKey } from 'sshpk';

const GITHUB_API = 'https://api.github.com';

const debug = debugAPI('knot:github');

export interface IGithubParams {
  readonly algorithm: string;
  readonly digest: string;
  readonly nonce: Buffer;
  readonly signature: Buffer | undefined;
}

interface IGithubKey {
  readonly id: number;
  readonly algorithm: string;
  readonly key: string;
}

type Cache = LRU.Cache<string, ReadonlyArray<IGithubKey>>;

export class GithubAuth {
  private readonly cache: Cache = new LRU({
    max: 10000,
    maxAge: 1000 * 60 * 60, /* 1 hour */
  });

  constructor() {
  }

  public async verify(user: string, params: IGithubParams) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/i.test(user)) {
      throw new Error(`Invalid github username: "${user}"`);
    }

    const maybeKeys = this.cache.get(user);
    if (maybeKeys !== undefined) {
      debug(`cache hit for: "${user}"`);
      return await this.check(maybeKeys, params);
    }

    debug(`cache miss for: "${user}"`);
    const res = await fetch(`${GITHUB_API}/users/${user}/keys`);
    const json = await res.json();

    const keys: IGithubKey[] = [];
    for (const item of json) {
      const [ algorithm ] = item.key.split(' ', 1);

      keys.push({
        id: item.id | 0,
        algorithm,
        key: item.key,
      });
    }

    debug(`got keys for: "${user}"`);
    this.cache.set(user, keys);

    return this.check(keys, params);
  }

  private async check(keys: ReadonlyArray<IGithubKey>, params: IGithubParams) {
    for (const key of keys) {
      if (params.algorithm !== key.algorithm) {
        continue;
      }

      debug(`trying ${key.algorithm}#${key.id}`);

      // Client is checking if we support this key
      if (!params.signature) {
        debug(`tentative success ${key.algorithm}#${key.id}`);
        return true;
      }

      const sshKey = parseKey(key.key, 'ssh');
      const v = sshKey.createVerify(params.digest) as any;
      v.update(params.nonce);

      if (v.verify(params.signature.toString('base64'), 'base64')) {
        debug(`success ${key.algorithm}#${key.id}`);
        return true;
      }
    }
    return false;
  }
}
