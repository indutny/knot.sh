import { Storage } from './storage';

interface 

class Output {
  constructor(private readonly storage: Storage) {
  }

  public write(column: number, row: number, value: string) {
    this.storage.write(column, row, value);
  }

  public clearRight(column: number, row: number) {
    this.storage.fill(column, row, ' ', this.storage.width - column);
  }
}
