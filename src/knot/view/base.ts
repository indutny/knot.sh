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
  public readonly frame: IViewFrame = {
    column: 0,
    row: 0,
    width: 80,
    height: 40,
  };

  protected privParent: View | undefined;
  private readonly privChildren: Set<View> = new Set();
  private activeChild: View | undefined;

  public get children(): ReadonlyArray<View> {
    return Array.from(this.privChildren);
  }

  public get parent(): View | undefined {
    return this.privParent;
  }

  public get root(): View {
    let res: View = this;
    while (res.privParent) {
      res = res.privParent;
    }
    return res;
  }

  public addChild(view: View) {
    this.privChildren.add(view);

    if (view.privParent) {
      throw new Error('View already has a parent');
    }
    view.privParent = this;

    // Make this child active by default
    this.makeActive(view);
  }

  public removeChild(view: View) {
    if (!this.privChildren.has(view)) {
      throw new Error('View isn\'t a child of this view');
    }

    this.privChildren.delete(view);
    view.privParent = undefined;

    if (this.activeChild === view) {
      this.activeChild = undefined;
    }
  }

  public makeActive(view: View) {
    if (!this.privChildren.has(view)) {
      throw new Error('View is not a child');
    }

    this.activeChild = view;
  }

  public onEvent(event: ViewEvent): boolean {
    // Propagate to active child
    if (this.activeChild) {
      return this.activeChild.onEvent(event);
    }
    return true;
  }

  public draw(output: Writable) {
    for (const view of this.children) {
      view.draw(output);
    }
  }
}
