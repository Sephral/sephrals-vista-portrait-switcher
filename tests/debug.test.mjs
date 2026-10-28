import assert from "node:assert/strict";
import test from "node:test";

globalThis._loc = (key, data) => (data ? `${key} ${data.file}` : key);

const {MODULE_ID, TESTED_VERSIONS} = await import("../scripts/config.mjs");
const {describeState, registerDebug} = await import("../scripts/debug.mjs");

/** A world with two characters, one with a gallery of two portraits, and one scene. */
function installWorld() {
  const actor = poses => ({flags: {[MODULE_ID]: {poses}}});
  globalThis.CONFIG = {Canvas: {managedScenes: {}}};
  globalThis.game = {
    version: "14.369",
    modules: new Map([["ember", {active: true, version: "0.6.3"}]]),
    actors: [actor([{id: "a", src: "a.webp", label: "A"}, {id: "b", src: "b.webp", label: "B"}]), actor([])],
    scenes: Object.assign([{id: "s1"}], {viewed: {id: "s1"}})
  };
}

test("the debug file part counts galleries and Vista scenes", () => {
  installWorld();
  assert.deepEqual(describeState(), {
    tested: TESTED_VERSIONS,
    installed: {ember: "0.6.3", core: "14.369"},
    galleries: {characters: 1, portraits: 2},
    vistaScenes: [],
    viewedSceneIsVista: false
  });
});

test("the module registers its part of the shared debug file", () => {
  installWorld();
  registerDebug();
  const provider = globalThis.sephralsDebugFiles.providers.get(MODULE_ID);
  assert.equal(provider.label(), "SVPS.DEBUG.Entry");
  assert.equal(provider.notice("x.json"), "SVPS.DEBUG.Saved x.json");
  assert.equal(provider.recent().details.galleries.portraits, 2);
  assert.equal(provider.message, undefined, "the module reads no chat messages");
});
