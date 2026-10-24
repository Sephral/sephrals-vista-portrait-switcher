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

/**
 * Map items with an async function, running at most `limit` calls at a time. The results keep the order of the items.
 * @param {Array} items
 * @param {number} limit
 * @param {(item: *, index: number) => Promise<*>} fn
 * @returns {Promise<Array>}
 */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while ( next < items.length ) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({length: Math.min(Math.max(1, limit), items.length)}, worker));
  return results;
}

/**
 * Put a gear into the title bar of a window that opens the settings of this module. Players only get it when the
 * module has settings for them.
 * @param {HTMLElement} frame   The window frame
 */
export function addSettingsGear(frame) {
  const header = frame?.querySelector(".window-header");
  if ( !header || header.querySelector(".svps-settings") ) return;
  const own = s => (s.namespace === MODULE_ID) && s.config && (s.scope !== "world");
  if ( !game.user.isGM && !Array.from(game.settings.settings.values()).some(own) ) return;
  const gear = document.createElement("button");
  gear.type = "button";
  gear.className = "header-control icon fa-solid fa-gear svps-settings";
  gear.dataset.tooltip = _loc("SVPS.Gallery.Settings");
  gear.setAttribute("aria-label", _loc("SVPS.Gallery.Settings"));
  gear.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    game.modules.get(MODULE_ID).api?.openSettings();
  });
  const anchor = header.querySelector("[data-action=toggleControls]") ?? header.querySelector("[data-action=close]");
  if ( anchor ) anchor.before(gear);
  else header.append(gear);
}
