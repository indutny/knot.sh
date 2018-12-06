// TODO(indutny): move to a separate module
import { Transform, TransformCallback } from 'stream';
import { Buffer } from 'buffer';

export type ANSIChar =
    { type: 'char', code: number } | { type: 'special', name: string };

export class ANSIReader extends Transform {
  private parser: IterableIterator<undefined>;

  constructor() {
    super({
      readableObjectMode: true,
    });

    this.parser = this.parse();

    // Just to start it up!
    this.parser.next(0);
  }

  public _transform(chunk: any, encoding: string, callback: TransformCallback) {
    const buffer = chunk instanceof Buffer ? chunk :
        Buffer.from(chunk, encoding);

    for (const code of buffer) {
      this.parser.next(code);
    }
    callback();
  }

  private *parse() {
    for (;;) {
      const code: number = yield;

      if (code >= 0x20 && code < 0x7f) {
        // Tab or printable chars
        this.push({ type: 'char', code });
        continue;
      }

      let name: string;
      if (code === 0x3) {
        name = '^C';
      } else if (code === 0x4) {
        name = '^D';
      } else if (code === 0x9) {
        name = 'TAB';
      } else if (code === 0xd) {
        name = 'CR';
      } else if (code === 0x7f) {
        name = 'DEL';
      } else {
        continue;
      }
      this.push({ type: 'special', name });
    }
  }
}
