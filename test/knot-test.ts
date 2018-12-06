import { Knot } from '../src/knot';

import { KEYS } from './fixtures';

describe('Knot server', () => {
  it('should start', () => {
    const k = new Knot({ hostKeys: [ KEYS.server ] });

    k.listen(1382, () => {
      console.log(k.address());
    });
  });
});
