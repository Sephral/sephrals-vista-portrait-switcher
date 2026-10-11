/**
 * Settings and hotkeys of the module. Like in every Sephral module, all options appear in Foundry's settings dialog
 * under this module, starting with the module language. World settings apply to everyone and are only shown to the
 * GM; user and client settings follow the user.
 */

import {MODULE_ID, POSE_HOTKEYS, TRANSITIONS} from "./config.mjs";
import {refreshGalleries} from "./gallery.mjs";
import {refreshTokenHUD} from "./hud.mjs";
import {hotkeyTargets, onPoseHotkey, onStepHotkey, onResetHotkey, onGalleryHotkey} from "./controls.mjs";
import {FOLLOW_FOUNDRY, applyModuleLanguage} from "./language.mjs";
import {runSelfTest} from "./selftest.mjs";

/**
 * @typedef SettingDefinition
 * @property {Function} type                  Boolean, String or Number
 * @property {*} default
 * @property {Record<string, string>} [choices]
 * @property {{min: number, max: number, step: number}} [range]
 * @property {"world"|"user"|"client"} [scope="world"]
 * @property {Function} [onChange]
 */

/**
 * The settings of the module, grouped by topic in the order they appear in the settings dialog.
 * @type {{id: string, settings: Record<string, SettingDefinition>}[]}
 */
export const SETTINGS = [
  {id: "language", settings: {
    uiLanguage: {type: String, default: FOLLOW_FOUNDRY, scope: "client", onChange: onLanguageChange, choices: {
      [FOLLOW_FOUNDRY]: "SVPS.LANGUAGE.default", de: "SVPS.LANGUAGE.de", en: "SVPS.LANGUAGE.en"}}
  }},
  {id: "players", settings: {
    playerSwitch: {type: Boolean, default: true, onChange: refreshTokenHUD},
    playerEdit: {type: Boolean, default: true, onChange: refreshTokenHUD}
  }},
  {id: "switching", settings: {
    applyTo: {type: String, default: "all", choices: {
      all: "SVPS.SETTINGS.applyTo.all", scene: "SVPS.SETTINGS.applyTo.scene"}},
    newTokens: {type: Boolean, default: true},
    chatNotice: {type: Boolean, default: false}
  }},
  {id: "transition", settings: {
    transition: {type: String, default: "fade", choices: Object.fromEntries([
      ["none", "SVPS.SETTINGS.transition.none"], ...TRANSITIONS.map(t => [t, `SVPS.TRANSITIONS.${t}`])])},
    transitionDuration: {type: Number, default: 600, range: {min: 100, max: 3000, step: 100}}
  }},
  {id: "display", settings: {
    hudButton: {type: Boolean, default: true, scope: "user", onChange: refreshTokenHUD}
  }}
];

/* -------------------------------------------- */

/**
 * Switch the module strings when the user picks another module language, and redraw what shows them.
 * @param {string} value
 */
function onLanguageChange(value) {
  applyModuleLanguage(value).then(() => {
    refreshTokenHUD();
    for ( const actor of game.actors ) refreshGalleries(actor);
    if ( game.settings.sheet?.rendered ) game.settings.sheet.render();
  });
}

/* -------------------------------------------- */

/**
 * The menu button which runs the self-test. Foundry only accepts application classes as menus; this one runs the test
 * instead of opening a window.
 */
class VistaSelfTestMenu extends foundry.applications.api.ApplicationV2 {
  /** @override */
  async render() {
    if ( game.user.isGM ) await runSelfTest();
    return this;
  }
}

/* -------------------------------------------- */

/**
 * Register all settings of the module and the self-test menu button.
 */
export function registerSettings() {
  for ( const group of SETTINGS ) {
    for ( const [key, def] of Object.entries(group.settings) ) {
      game.settings.register(MODULE_ID, key, {
        name: `SVPS.SETTINGS.${key}.name`,
        hint: `SVPS.SETTINGS.${key}.hint`,
        scope: def.scope ?? "world",
        config: true,
        type: def.range ? new foundry.data.fields.NumberField({...def.range, initial: def.default}) : def.type,
        choices: def.choices,
        default: def.default,
        onChange: def.onChange
      });
    }
  }

  // The newer Ember and Foundry versions the GM was already told about
  game.settings.register(MODULE_ID, "acknowledgedVersions", {scope: "client", config: false, type: String, default: ""});

  game.settings.registerMenu(MODULE_ID, "selfTest", {
    name: "SVPS.SELFTEST.Title",
    label: "SVPS.SELFTEST.Run",
    hint: "SVPS.SELFTEST.Hint",
    icon: "fa-solid fa-stethoscope",
    type: VistaSelfTestMenu,
    restricted: true
  });
}

/* -------------------------------------------- */

/**
 * Open Foundry's settings dialog on the page of this module.
 */
export function openSettings() {
  const app = game.settings.sheet;
  if ( !app.rendered ) return app.render({force: true, tab: {categories: MODULE_ID}});
  app.changeTab(MODULE_ID, "categories");
  app.bringToFront();
}

/* -------------------------------------------- */

/**
 * Register the hotkeys. They act on the controlled tokens in the viewed Vista, or on the user's own character.
 */
export function registerKeybindings() {
  const {ALT} = foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS;
  const register = (key, editable, onDown) => game.keybindings.register(MODULE_ID, key, {
    name: `SVPS.KEYS.${key}.name`,
    hint: `SVPS.KEYS.${key}.hint`,
    editable,
    onDown: () => {
      const targets = hotkeyTargets();
      if ( !targets.length ) return false;
      onDown(targets);
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
  for ( let n = 1; n <= POSE_HOTKEYS; n++ ) {
    register(`pose${n}`, [{key: `Digit${n}`, modifiers: [ALT]}], targets => onPoseHotkey(targets, n));
  }
  register("poseReset", [{key: "Digit0", modifiers: [ALT]}], onResetHotkey);
  register("poseNext", [{key: "PageDown", modifiers: [ALT]}], targets => onStepHotkey(targets, 1));
  register("posePrevious", [{key: "PageUp", modifiers: [ALT]}], targets => onStepHotkey(targets, -1));
  register("openGallery", [], onGalleryHotkey);
}
