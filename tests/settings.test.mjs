import assert from "node:assert/strict";
import test from "node:test";

// settings.mjs and the modules it imports touch these Foundry APIs at import time
globalThis.foundry = {
  utils: {deepClone: value => structuredClone(value)},
  applications: {api: {ApplicationV2: class {}, HandlebarsApplicationMixin: cls => cls}}
};

const {FOLLOW_FOUNDRY, UI_LANGUAGES, applyModuleLanguage, forcedLanguage, mergeStrings} =
  await import("../scripts/language.mjs");
const {SETTINGS} = await import("../scripts/settings.mjs");

const definitions = Object.fromEntries(SETTINGS.flatMap(group => Object.entries(group.settings)));

test("the module language comes first and follows Foundry by default", () => {
  assert.deepEqual(Object.keys(SETTINGS[0].settings), ["uiLanguage"]);
  const {uiLanguage} = definitions;
  assert.equal(uiLanguage.scope, "client");
  assert.equal(uiLanguage.default, FOLLOW_FOUNDRY);
  assert.deepEqual(Object.keys(uiLanguage.choices), [FOLLOW_FOUNDRY, "de", "en"]);
  assert.deepEqual(UI_LANGUAGES, ["en", "de"]);
});

test("the options keep their keys, scopes and defaults", () => {
  const summary = Object.fromEntries(Object.entries(definitions)
    .map(([key, def]) => [key, `${def.scope ?? "world"}:${def.default}`]));
  assert.deepEqual(summary, {
    uiLanguage: "client:default", playerSwitch: "world:true", playerEdit: "world:true", applyTo: "world:all",
    newTokens: "world:true", chatNotice: "world:false", transition: "world:fade", transitionDuration: "world:600",
    hudButton: "user:true"
  });
  assert.deepEqual(definitions.transitionDuration.range, {min: 100, max: 3000, step: 100});
  assert.equal(Object.keys(definitions.transition.choices)[0], "none");
});

test("forcedLanguage only forces the shipped languages", () => {
  assert.equal(forcedLanguage("de"), "de");
  assert.equal(forcedLanguage("en"), "en");
  assert.equal(forcedLanguage(FOLLOW_FOUNDRY), null);
  assert.equal(forcedLanguage("fr"), null);
  assert.equal(forcedLanguage(undefined), null);
});

test("mergeStrings lays the forced file over Foundry's strings", () => {
  const loaded = {OwnPortrait: "Eigenes Porträt", HUD: {Button: "Vista-Porträts", Reset: "Zurück"}, Only: "nur geladen"};
  const forced = {OwnPortrait: "Own portrait", HUD: {Button: "Vista portraits"}};
  assert.deepEqual(mergeStrings(loaded, forced),
    {OwnPortrait: "Own portrait", HUD: {Button: "Vista portraits", Reset: "Zurück"}, Only: "nur geladen"});
  assert.deepEqual(loaded.HUD, {Button: "Vista-Porträts", Reset: "Zurück"}, "the loaded strings stay untouched");
  assert.deepEqual(mergeStrings(undefined, forced), forced);
});

test("applyModuleLanguage forces a language and restores Foundry's strings", async () => {
  globalThis.game = {i18n: {translations: {SVPS: {OwnPortrait: "Eigenes Porträt", Light: "x"}, CORE: {x: 1}}}};
  globalThis.fetch = async url => {
    assert.match(String(url), /lang\/en\.json$/);
    return {ok: true, json: async () => ({SVPS: {OwnPortrait: "Own portrait"}})};
  };
  await applyModuleLanguage("en");
  assert.deepEqual(game.i18n.translations.SVPS, {OwnPortrait: "Own portrait", Light: "x"});
  assert.deepEqual(game.i18n.translations.CORE, {x: 1});

  await applyModuleLanguage(FOLLOW_FOUNDRY);
  assert.deepEqual(game.i18n.translations.SVPS, {OwnPortrait: "Eigenes Porträt", Light: "x"});
  delete globalThis.game;
  delete globalThis.fetch;
});
