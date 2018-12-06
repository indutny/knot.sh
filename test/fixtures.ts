import * as fs from 'fs';
import * as path from 'path';

const KEY_DIR = path.join(__dirname, 'keys');

export const KEYS = {
  client: fs.readFileSync(path.join(KEY_DIR, 'client')),
  server: fs.readFileSync(path.join(KEY_DIR, 'server')),
};
