import assert from "node:assert/strict";
import test from "node:test";

import {mapLimit} from "../scripts/config.mjs";

test("mapLimit keeps the order of the items and runs at most limit calls at once", async () => {
  let running = 0;
  let most = 0;
  const delays = [30, 5, 20, 1, 15, 10, 25, 3];
  const results = await mapLimit(delays, 3, async (delay, index) => {
    running++;
    most = Math.max(most, running);
    await new Promise(resolve => setTimeout(resolve, delay));
    running--;
    return `${index}:${delay}`;
  });
  assert.deepEqual(results, delays.map((delay, index) => `${index}:${delay}`));
  assert.equal(most, 3);
});

test("mapLimit handles empty lists and small limits", async () => {
  assert.deepEqual(await mapLimit([], 6, async x => x), []);
  assert.deepEqual(await mapLimit([1, 2, 3], 0, async x => x * 2), [2, 4, 6]);
  assert.deepEqual(await mapLimit([1, 2], 10, async x => x + 1), [2, 3]);
});
