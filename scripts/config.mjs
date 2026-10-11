/**
 * Constants and small helpers shared by the scripts of the module.
 */

/** The id of this module. */
export const MODULE_ID = "sephrals-vista-portrait-switcher";

/** The folder of the module's templates. */
export const TEMPLATES = `modules/${MODULE_ID}/templates`;

/** The id of the pose palette in the token HUD. */
export const PALETTE_ID = "svps-poses";

/**
 * Texture transitions of Foundry's token animation that can be chosen for a portrait change.
 * @type {string[]}
 */
export const TRANSITIONS = ["fade", "dots", "crosshatch", "glitch", "hole", "holeSwirl", "hologram", "morph", "swirl",
  "waterDrop", "waves", "wind", "whiteNoise"];

/** How many poses get their own hotkey. */
export const POSE_HOTKEYS = 9;

/** The versions of Ember and Foundry the module was verified against (see the self-test). */
export const TESTED_VERSIONS = {ember: "0.6.3", core: "14.369"};

/**
 * Read a setting of this module.
 * @param {string} key
 * @returns {*}
 */
export function setting(key) {
  return game.settings.get(MODULE_ID, key);
}

/**
 * Create a random id for a new pose.
 * @returns {string}
 */
export function makeId() {
  return foundry.utils.randomID();
}
