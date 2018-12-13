import { EventEmitter } from 'events';
import * as debugAPI from 'debug';
import { Buffer } from 'buffer';
import * as ssh2 from 'ssh2';

import { ANSIChar, ANSIReader } from './ansi-reader';
import { Editor, Prompt, Window } from './view';
import { Room } from './model';

const debugFn = debugAPI('knot:client');

export class Client extends EventEmitter {
  private channel: ssh2.ServerChannel | undefined;
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
    const channel = this.channel!;
    for await (const ch of this.ansiReader) {
      this.window.receiveANSI(ch, channel.stdout);
    }
  }

  public async present() {
    const channel = this.channel!;
    const window = this.window;

    const prompt = new Prompt('Enter room id: ');
    window.addChild(prompt);
    window.draw(channel.stdout);

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
      window.draw(channel.stdout);

      await editor.awaitExit();
    } finally {
      room.leave(this.username);
    }
  }
}
