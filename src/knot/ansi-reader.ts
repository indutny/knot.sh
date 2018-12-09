// TODO(indutny): move to a separate module
import { Transform, TransformCallback } from 'stream';
import { Buffer } from 'buffer';

export type ANSIChar =
  { type: 'char', value: string } |
  { type: 'special', name: string } |
  { type: 'csi', name: string, params: ReadonlyArray<string> };

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

  private special(name: string) {
    this.push({ type: 'special', name });
  }

  public _transform(chunk: any, encoding: string, callback: TransformCallback) {
    const buffer = chunk instanceof Buffer ? chunk :
        Buffer.from(chunk, encoding);

    for (const code of buffer) {
      this.parser.next(code);
    }
    callback();
  }

  private *parse(): IterableIterator<undefined> {
    for (;;) {
      const code: number = yield;

      if (code >= 0x20 && code < 0x7f) {
        // Tab or printable chars
        this.push({ type: 'char', value: String.fromCharCode(code) });
        continue;
      }

      const utfBytes = (code & 0xe0) === 0xc0 ? 2 :
                       (code & 0xf0) === 0xe0 ? 3 :
                       (code & 0xf8) === 0xf0 ? 4 : 1;

      if (utfBytes > 1) {
        let utf = code & ((1 << (7 - utfBytes)) - 1);
        let invalid = false;
        for (let i = 1; i < utfBytes; i++) {
          utf <<= 6;

          const next: number = yield;
          if ((next & 0xc0) !== 0x80) {
            invalid = true;
          }

          utf |= next & 0x3f;
        }
        this.push({ type: 'char', value: String.fromCharCode(utf) });
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
      } else if (code === 0x1b) {
        // ESC
        yield* this.parseSequence();
        continue;
      } else {
        continue;
      }
      this.push({ type: 'special', name });
    }
  }

  private *parseSequence() {
    const firstCode: number = yield;
    const ch = String.fromCharCode(firstCode);

    if (ch === 'N') {
      this.special('SS2');
    } else if (ch === 'O') {
      this.special('SS3');
    } else if (ch === 'P') {
      this.special('DCS');
    } else if (ch === '\\') {
      this.special('ST');
    } else if (ch === 'X') {
      this.special('SOS');
    } else if (ch === '^') {
      this.special('PM');
    } else if (ch === '_') {
      this.special('APC');
    } else if (ch === 'c') {
      this.special('RIS');
    }

    if (ch !== '[') {
      this.special('ESC');
      this.push({ type: 'char', code: firstCode });
      return;
    }

    let b: number = yield;

    let params = '';
    for (;;) {
      if (b < 0x30 || b > 0x3f) {
        break;
      }

      params += String.fromCharCode(b);
      b = yield;
    }

    // Intermediate bytes
    for (;;) {
      if (b < 0x20 || b > 0x2f) {
        break;
      }
      b = yield;
    }

    const op = String.fromCharCode(b);
    let name: string;
    if (op === 'A') {
      name = 'CUU';
    } else if (op === 'B') {
      name = 'CUD';
    } else if (op === 'C') {
      name = 'CUF';
    } else if (op === 'D') {
      name = 'CUB';
    } else if (op === 'E') {
      name = 'CNL';
    } else if (op === 'F') {
      name = 'CPL';
    } else if (op === 'G') {
      name = 'CHA';
    } else if (op === 'H') {
      name = 'CUP';
    } else if (op === 'J') {
      name = 'ED';
    } else if (op === 'K') {
      name = 'EL';
    } else if (op === 'S') {
      name = 'SU';
    } else if (op === 'T') {
      name = 'SD';
    } else if (op === 'f') {
      name = 'HVP';
    } else if (op === 'm') {
      name = 'SGR';
    } else if (op === 's' && params === '') {
      name = 'SCP';
    } else if (op === 'u' && params === '') {
      name = 'RCP';
    } else {
      name = 'UNKNOWN';
    }

    // Few defaults
    if (name === 'CUU' || name === 'CUD' || name === 'CUF' || name === 'CUB' ||
        name === 'CNL' || name === 'CPL' || name === 'CHA') {
      params = params || '1';
    } else if (name === 'CUP') {
      let [ row, column ] = (params + ';').split(';', 2);
      if (!row) {
        row = '1';
      }
      if (!column) {
        column = '1';
      }
      params = `${row};${column}`;
    }

    this.push({ type: 'csi', name, params: params.split(';') });
  }
}
