import { Writable } from 'stream';

export interface IViewFrame {
  column: number;
  row: number;
  width: number;
  height: number;
}

export interface ICursorDelta {
  readonly column?: number;
  readonly row?: number;
}

export interface IWindowSize {
  readonly width: number;
  readonly height: number;
}

export type ViewEvent = {
  readonly name: 'cursor-move';
  readonly delta: ICursorDelta;
} | {
  readonly name: 'resize';
  readonly size: IWindowSize;
} | {
  readonly name: 'write';
  readonly value: string;
} | {
  readonly name: 'newline';
} | {
  readonly name: 'backspace';
} | {
  readonly name: '^C';
} | {
  readonly name: '^D';
};

export class View {
  constructor(public readonly output: Writable,
              public readonly frame: IViewFrame) {
  }

  public abstract draw();

  // Events

  public onEvent(event: ViewEvent) {
    // Ignore
  }
}
