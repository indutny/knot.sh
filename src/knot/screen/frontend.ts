import { Backend } from './backend';

export interface IScreenRegion {
  readonly column: number;
  readonly row: number;

  readonly width: number;
  readonly height: number;
}

export class Frontend {
  protected readonly region: IScreenRegion;

  constructor(private readonly backend: Backend,
              protected readonly parent?: Frontend,
              region?: IScreenRegion) {
    let maxWidth: number;
    let maxHeight: number;
    if (this.parent) {
      maxWidth = this.parent.width;
      maxHeight = this.parent.height;
    } else {
      maxWidth = this.backend.width;
      maxHeight = this.backend.height;
    }

    if (!region) {
      region = { column: 0, row: 0, width: maxWidth, height: maxHeight };
    }

    if (region.width + region.column > maxWidth) {
      throw new Error('Width overflow');
    }

    if (region.height + region.row > maxHeight) {
      throw new Error('Height overflow');
    }

    this.region = region;
  }

  public get width(): number {
    return this.region.width;
  }

  public get height(): number {
    return this.region.height;
  }

  public write(column: number, row: number, value: string) {
    const [ realColumn, realRow ] = this.translate(column, row);
    this.backend.write(realColumn, realRow, value);
  }

  public clearRight(column: number, row: number) {
    const [ realColumn, realRow ] = this.translate(column, row);
    this.backend.fill(realColumn, realRow, ' ', this.width - column);
  }

  public setCursor(column: number, row: number) {
    this.backend.setCursor(column, row);
  }

  private translate(column: number, row: number): [ number, number ] {
    let out: Frontend | undefined = this;

    do {
      // Crop coordinates
      column = Math.max(0, Math.min(out!.region.width, column));
      row = Math.max(0, Math.min(out!.region.height, row));

      // Adjust coordinates
      column += out!.region.column;
      row += out!.region.row;

      out = out!.parent;
    } while (out !== undefined);

    return [ column, row ];
  }
}
