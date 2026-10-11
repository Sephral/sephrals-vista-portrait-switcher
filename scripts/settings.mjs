/**
 * Settings and hotkeys of the module.
 */

import {MODULE_ID, POSE_HOTKEYS, TRANSITIONS} from "./config.mjs";
import {refreshTokenHUD} from "./hud.mjs";
import {hotkeyTargets, onPoseHotkey, onStepHotkey, onLightHotkey, onResetHotkey, onGalleryHotkey} from "./controls.mjs";

/**
 * Register the settings of the module. World settings are for the GM, user settings follow a user to every device.
 */
export function registerSettings() {
  const world = (key, config) => game.settings.register(MODULE_ID, key, {
    name: `SVPS.SETTINGS.${key}.name`, hint: `SVPS.SETTINGS.${key}.hint`, scope: "world", config: true, ...config
  });

  world("playerSwitch", {type: Boolean, default: true, onChange: refreshTokenHUD});
  world("playerEdit", {type: Boolean, default: true, onChange: refreshTokenHUD});
  world("applyTo", {type: String, default: "all", choices: {
    all: "SVPS.SETTINGS.applyTo.all", scene: "SVPS.SETTINGS.applyTo.scene"
  }});
  world("newTokens", {type: Boolean, default: true});
  world("transition", {type: String, default: "fade", choices: Object.fromEntries([
    ["none", "SVPS.SETTINGS.transition.none"], ...TRANSITIONS.map(t => [t, `SVPS.TRANSITIONS.${t}`])
  ])});
  world("transitionDuration", {
    type: new foundry.data.fields.NumberField({min: 100, max: 3000, step: 100, initial: 600}), default: 600
  });
  world("chatNotice", {type: Boolean, default: false});

  game.settings.register(MODULE_ID, "hudButton", {
    name: "SVPS.SETTINGS.hudButton.name", hint: "SVPS.SETTINGS.hudButton.hint",
    scope: "user", config: true, type: Boolean, default: true, onChange: refreshTokenHUD
  });
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
  register("toggleLight", [{key: "KeyL", modifiers: [ALT]}], onLightHotkey);
  register("openGallery", [], onGalleryHotkey);
}
