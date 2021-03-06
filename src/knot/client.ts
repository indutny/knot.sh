import { EventEmitter } from 'events';
import * as debugAPI from 'debug';
import { Buffer } from 'buffer';
import * as ssh2 from 'ssh2';

import { ANSIChar, ANSIReader } from './ansi-reader';
import { Editor, Prompt, Window } from './view';
import { Backend as ScreenBackend } from './screen';
import { Room } from './model';

const debugFn = debugAPI('knot:client');

export class Client extends EventEmitter {
  private channel: ssh2.ServerChannel | undefined;
  private screenBackend: ScreenBackend | undefined;
  private readonly ansiReader = new ANSIReader();
  private readonly window = new Window();

  constructor(public readonly username: string,
              private readonly rooms: Map<string, Room>,
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

        this.channel = accept() as ssh2.ServerChannel;

        // TODO(indutny): proper width, height
        this.screenBackend = new ScreenBackend(this.channel, 80, 40);

        this.onChannel().catch((e) => {
          this.debug(`shell error "${e.stack}"`);
          this.channel!.stderr.write(`\r\n${e.message}\r\n`);
          this.connection.end();
        });
      });
    });
  }

  private async onChannel() {
    const channel = this.channel!;

    channel.allowHalfOpen = false;
    channel.stdin.pipe(this.ansiReader);

    await Promise.race([
      this.loop(),
      this.present(),
    ]);

    channel.end();
  }

  private async loop() {
    for await (const ch of this.ansiReader) {
      this.window.receiveANSI(ch, this.screenBackend!);
    }
  }

  public async present() {
    const window = this.window;

    const prompt = new Prompt('Enter room id: ');
    window.addChild(prompt);
    window.redraw(this.screenBackend!);

    const roomName = await prompt.present();
    window.removeChild(prompt);

    this.debug(`Got room name "${roomName}"`);

    let room: Room;
    if (this.rooms.has(roomName)) {
      this.debug(`Room exists`);
      room = this.rooms.get(roomName)!;
    } else {
      this.debug(`Create new room`);
      room = new Room(roomName);
      this.rooms.set(roomName, room);
    }

    room.enter(this.username);

    try {
      const editor = new Editor(room.editor);
      window.addChild(editor);
      window.redraw(this.screenBackend!);

      await Promise.race([
        editor.awaitExit(),
        this.roomLoop(room, window),
      ]);
    } finally {
      room.leave(this.username);
    }
  }

  public async roomLoop(room: Room, window: Window) {
    for (;;) {
      await room.editor.awaitChange();

      window.redraw(this.screenBackend!);
    }
  }
}
