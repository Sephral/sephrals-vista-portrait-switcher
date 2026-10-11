/**
 * Self-test: checks the integration points which depend on Ember and Foundry internals and whether every image of
 * the galleries can be loaded. Meant to be run after every Ember or Foundry update.
 */

import {MODULE_ID, TESTED_VERSIONS, TRANSITIONS} from "./config.mjs";
import {usablePoses} from "./poses.mjs";
import {getPoses, imageAspect, isVistaScene} from "./vista.mjs";

/**
 * Check Ember's Vista API, the Vista scenes of the world and Foundry's texture transitions.
 * @returns {{problems: string[], vistas: number}}
 */
function checkIntegrations() {
  const problems = [];
  if ( !game.modules.get("ember")?.active ) problems.push(_loc("SVPS.SELFTEST.EmberInactive"));
  if ( !globalThis.ember?.api?.canvas?.sceneManagers?.EmberVista ) problems.push(_loc("SVPS.SELFTEST.VistaClass"));
  if ( !CONFIG.Canvas.managedScenes ) problems.push(_loc("SVPS.SELFTEST.ManagedScenes"));
  const vistaScenes = game.scenes.filter(isVistaScene);
  if ( !vistaScenes.length ) problems.push(_loc("SVPS.SELFTEST.NoVistas"));
  const vistaTokens = vistaScenes.flatMap(s => s.tokens.contents);
  if ( vistaTokens.length && !vistaTokens.some(t => foundry.utils.hasProperty(t, "flags.ember.portrait")) ) {
    problems.push(_loc("SVPS.SELFTEST.PortraitFlag"));
  }
  const types = Object.values(foundry.canvas.rendering?.filters?.TextureTransitionFilter?.TYPES ?? {});
  const unknown = TRANSITIONS.filter(t => !types.includes(t));
  if ( unknown.length ) problems.push(_loc("SVPS.SELFTEST.Transitions", {types: unknown.join(", ")}));
  return {problems, vistas: vistaScenes.length};
}

/* -------------------------------------------- */

/**
 * Load every image of every gallery.
 * @returns {Promise<{galleries: number, images: number, missing: string[]}>}
 */
async function checkImages() {
  const missing = [];
  let galleries = 0;
  let images = 0;
  for ( const actor of game.actors ) {
    const poses = usablePoses(getPoses(actor));
    if ( !poses.length ) continue;
    galleries++;
    for ( const pose of poses ) {
      images++;
      if ( !(await imageAspect(pose.src)) ) missing.push(`${actor.name} – ${pose.label}: ${pose.src}`);
    }
  }
  return {galleries, images, missing};
}

/* -------------------------------------------- */

/**
 * The installed versions next to the tested ones.
 * @returns {string}
 */
function versionLine() {
  const current = {ember: game.modules.get("ember")?.version, core: game.version};
  return Object.entries(TESTED_VERSIONS)
    .map(([id, tested]) => _loc("SVPS.SELFTEST.Version", {id, current: current[id] ?? "–", tested}))
    .join(", ");
}

/* -------------------------------------------- */

/**
 * Run the self-test and report the result as a notification and a whispered chat message.
 * @param {object} [options]
 * @param {boolean} [options.report=true]   Post the chat report
 * @returns {Promise<{integrations: string[], vistas: number, galleries: number, images: number, missing: string[]}>}
 */
export async function runSelfTest({report=true}={}) {
  ui.notifications.info(_loc("SVPS.SELFTEST.Started"));
  const {problems: integrations, vistas} = checkIntegrations();
  const {galleries, images, missing} = await checkImages();
  const versions = versionLine();
  const summary = _loc("SVPS.SELFTEST.Summary", {vistas, galleries, images, missing: missing.length,
    integrations: integrations.length});

  console.group(`${MODULE_ID} | Self-test`);
  console.log(versions);
  if ( integrations.length ) console.warn("Integrations:", integrations);
  if ( missing.length ) console.warn("Missing images:", missing);
  console.groupEnd();

  if ( integrations.length || missing.length ) ui.notifications.warn(summary, {permanent: true});
  else ui.notifications.info(summary);

  if ( report ) {
    const escape = foundry.utils.escapeHTML;
    const list = items => `<ul>${items.map(i => `<li>${escape(i)}</li>`).join("")}</ul>`;
    let content = `<h3>${_loc("SVPS.SELFTEST.Title")}</h3><p>${escape(summary)}</p><p><small>${escape(versions)}</small></p>`;
    if ( integrations.length ) content += `<h4>${_loc("SVPS.SELFTEST.Integrations")}</h4>${list(integrations)}`;
    if ( missing.length ) content += `<h4>${_loc("SVPS.SELFTEST.Missing")}</h4>${list(missing)}`;
    const cls = foundry.documents.ChatMessage.implementation;
    await cls.create({content, whisper: [game.user.id], speaker: {alias: game.modules.get(MODULE_ID).title}});
  }
  return {integrations, vistas, galleries, images, missing};
}

/* -------------------------------------------- */

/**
 * Compare two dotted version numbers.
 * @param {string} a
 * @param {string} b
 * @returns {number}  Positive if a is newer
 */
function compareVersions(a, b) {
  return foundry.utils.isNewerVersion(a, b) ? 1 : (foundry.utils.isNewerVersion(b, a) ? -1 : 0);
}

/**
 * Tell the GM once when Ember or Foundry is newer than the versions the module was verified against.
 */
export function noticeNewVersions() {
  if ( !game.user.isGM ) return;
  const current = {ember: game.modules.get("ember")?.active ? game.modules.get("ember").version : null, core: game.version};
  const newer = Object.entries(current)
    .filter(([id, version]) => version && (compareVersions(version, TESTED_VERSIONS[id]) > 0))
    .map(([id, version]) => `${id} ${version}`);
  if ( !newer.length ) return;
  const signature = newer.join(",");
  if ( game.settings.get(MODULE_ID, "acknowledgedVersions") === signature ) return;
  game.settings.set(MODULE_ID, "acknowledgedVersions", signature);
  ui.notifications.info(_loc("SVPS.SELFTEST.NewVersions", {versions: newer.join(", ")}), {permanent: true});
}
