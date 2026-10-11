/**
 * The Ember Vista integration: which scenes are Vistas, which tokens show a character, and switching the portrait
 * of those tokens. In a Vista a token is drawn from its feet (the document position) upwards, sized by the portrait
 * data in `flags.ember.portrait`, so a new image only needs the texture, the portrait data and a scaled size.
 */

import {MODULE_ID, makeId, setting} from "./config.mjs";
import {
  cleanPortrait, cyclePose, findPose, flippedScaleX, normalizePoses, posePortrait, scaledSize, usablePoses
} from "./poses.mjs";

/**
 * @typedef PoseTarget
 * @property {Actor} actor                The world actor whose gallery is used
 * @property {boolean} linked             Does the switch apply to the character (all its linked tokens)?
 * @property {TokenDocument[]} tokens     The Vista tokens to change
 * @property {TokenDocument} [origin]     The token the switch was made on
 */

/* -------------------------------------------- */
/*  Vistas                                      */
/* -------------------------------------------- */

/**
 * Is this scene one of Ember's Vistas (side-view panoramas)?
 * @param {Scene|null} scene
 * @returns {boolean}
 */
export function isVistaScene(scene) {
  if ( !scene?.id ) return false;
  const Vista = globalThis.ember?.api?.canvas?.sceneManagers?.EmberVista;
  const cls = CONFIG.Canvas.managedScenes?.[scene.id];
  if ( Vista && (typeof cls === "function") ) return (cls === Vista) || (cls.prototype instanceof Vista);
  return Object.values(globalThis.ember?.scenes?.vistas ?? {}).some(v => v?.id === scene.id);
}

/* -------------------------------------------- */

/**
 * The linked tokens of a character in Vistas.
 * @param {Actor} actor
 * @param {Scene|null} [scene]    Only this scene
 * @returns {TokenDocument[]}
 */
export function vistaTokensOf(actor, scene=null) {
  const scenes = scene ? [scene] : game.scenes.contents;
  return scenes.filter(isVistaScene)
    .flatMap(s => s.tokens.filter(t => t.actorLink && (t.actorId === actor.id)));
}

/* -------------------------------------------- */
/*  Galleries and permissions                   */
/* -------------------------------------------- */

/**
 * The world actor whose gallery a token or actor uses (also for unlinked tokens).
 * @param {Token|TokenDocument|Actor|null} target
 * @returns {Actor|null}
 */
export function galleryActor(target) {
  if ( target instanceof foundry.canvas.placeables.Token ) target = target.document;
  if ( target instanceof foundry.documents.TokenDocument ) return target.baseActor ?? target.actor ?? null;
  if ( target instanceof foundry.documents.Actor ) return target.isToken ? (target.token?.baseActor ?? target) : target;
  return null;
}

/* -------------------------------------------- */

/**
 * The gallery of an actor.
 * @param {Actor|null} actor
 * @returns {import("./poses.mjs").VistaPose[]}
 */
export function getPoses(actor) {
  return normalizePoses(actor?.flags?.[MODULE_ID]?.poses ?? [], makeId);
}

/* -------------------------------------------- */

/** Proportions of images by path, loaded once per client. */
const aspects = new Map();

/**
 * The proportions (width / height) of an image, or null if it cannot be loaded.
 * @param {string} src
 * @returns {Promise<number|null>}
 */
export function imageAspect(src) {
  if ( !src ) return Promise.resolve(null);
  if ( !aspects.has(src) ) {
    const promise = new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img.naturalHeight ? (img.naturalWidth / img.naturalHeight) : null);
      img.onerror = () => resolve(null);
      img.src = src;
    }).then(aspect => {
      if ( !aspect ) aspects.delete(src);
      return aspect;
    });
    aspects.set(src, promise);
  }
  return aspects.get(src);
}

/* -------------------------------------------- */

/**
 * Store a gallery on an actor. The proportions of every image are measured and kept with the pose, so new tokens
 * can be sized without waiting for an image.
 * @param {Actor} actor
 * @param {object[]} poses
 * @returns {Promise<import("./poses.mjs").VistaPose[]>}
 */
export async function savePoses(actor, poses) {
  const normalized = normalizePoses(poses, makeId);
  for ( const pose of normalized ) pose.aspect = (await imageAspect(pose.src)) ?? pose.aspect;
  await actor.update({[`flags.${MODULE_ID}.poses`]: normalized});
  return normalized;
}

/* -------------------------------------------- */

/**
 * May the current user switch the portrait of this actor?
 * @param {Actor|null} actor
 * @returns {boolean}
 */
export function canSwitch(actor) {
  if ( !actor ) return false;
  if ( game.user.isGM ) return true;
  return actor.isOwner && !!setting("playerSwitch");
}

/**
 * May the current user edit the gallery of this actor?
 * @param {Actor|null} actor
 * @returns {boolean}
 */
export function canEdit(actor) {
  if ( !actor ) return false;
  if ( game.user.isGM ) return true;
  return actor.isOwner && !!setting("playerEdit");
}

/* -------------------------------------------- */
/*  State                                       */
/* -------------------------------------------- */

/**
 * The pose stored on a document.
 * @param {object} flags
 * @param {{pose: string|null}} fallback
 * @returns {{pose: string|null}}
 */
function stateFrom(flags, fallback) {
  flags ??= {};
  return {pose: ("pose" in flags) ? (flags.pose ?? null) : fallback.pose};
}

/**
 * The current pose of a character, a token or the character a token belongs to.
 * @param {Token|TokenDocument|Actor} target
 * @returns {{pose: string|null}}
 */
export function poseState(target) {
  if ( target instanceof foundry.canvas.placeables.Token ) target = target.document;
  const actor = galleryActor(target);
  const actorState = stateFrom(actor?.flags?.[MODULE_ID], {pose: null});
  if ( !(target instanceof foundry.documents.TokenDocument) ) return actorState;
  return stateFrom(target.flags?.[MODULE_ID], target.actorLink ? actorState : {pose: null});
}

/* -------------------------------------------- */
/*  Switching                                   */
/* -------------------------------------------- */

/**
 * Work out which tokens a switch applies to.
 * - A linked token or a character: all its Vista tokens (or those of one scene, see the "applyTo" setting).
 * - An unlinked token: only that token.
 * - An actor whose tokens are unlinked: its controlled tokens in the viewed Vista.
 * @param {Token|TokenDocument|Actor|string} target
 * @returns {PoseTarget|null}
 */
export function resolveTarget(target) {
  if ( typeof target === "string" ) target = game.actors.get(target) ?? game.actors.getName(target) ?? uuidDocument(target);
  if ( target instanceof foundry.canvas.placeables.Token ) target = target.document;
  if ( (target instanceof foundry.documents.Actor) && target.isToken ) target = target.token;
  const actor = galleryActor(target);
  if ( !actor ) return null;
  const onlyScene = setting("applyTo") === "scene";

  if ( target instanceof foundry.documents.TokenDocument ) {
    if ( !target.actorLink ) return {actor, linked: false, tokens: [target], origin: target};
    return {actor, linked: true, tokens: vistaTokensOf(actor, onlyScene ? target.parent : null), origin: target};
  }

  if ( actor.prototypeToken.actorLink ) {
    return {actor, linked: true, tokens: vistaTokensOf(actor, onlyScene ? (canvas.scene ?? null) : null)};
  }
  const controlled = (canvas.tokens?.controlled ?? []).map(t => t.document)
    .filter(d => !d.actorLink && (d.actorId === actor.id) && isVistaScene(d.parent));
  return {actor, linked: false, tokens: controlled};
}

/* -------------------------------------------- */

/**
 * The document with this UUID, or null if the text is no UUID.
 * @param {string} uuid
 * @returns {foundry.abstract.Document|null}
 */
function uuidDocument(uuid) {
  try {
    return fromUuidSync(uuid) ?? null;
  } catch {
    return null;
  }
}

/* -------------------------------------------- */

/**
 * The update options for a portrait change: Foundry's texture transition, or none.
 * @returns {object}
 */
function updateOptions() {
  const transition = setting("transition");
  if ( transition === "none" ) return {animate: false};
  return {animation: {transition, duration: setting("transitionDuration")}};
}

/* -------------------------------------------- */

/**
 * Show a pose (or the actor's own portrait) on the Vista tokens of a character or token.
 * @param {Token|TokenDocument|Actor|string} target
 * @param {string|number|null} ref      Pose id, name or 1-based number; null = the actor's own portrait
 * @param {object} [options]
 * @param {boolean} [options.notify]    Warn when nothing could be changed
 * @returns {Promise<{tokens: number}|null>}  The number of changed tokens, null if nothing was done
 */
export async function applyPose(target, ref, {notify=true}={}) {
  const resolved = resolveTarget(target);
  if ( !resolved ) return null;
  const {actor, linked, tokens, origin} = resolved;
  if ( !canSwitch(actor) ) {
    if ( notify ) ui.notifications.warn(_loc("SVPS.Notify.NoPermission", {name: actor.name}));
    return null;
  }

  const poses = getPoses(actor);
  const pose = (ref === null) ? null : findPose(poses, ref);
  if ( (ref !== null) && !pose ) {
    if ( notify ) ui.notifications.warn(_loc("SVPS.Notify.UnknownPose", {pose: ref, name: actor.name}));
    return null;
  }
  if ( !linked && !tokens.length ) {
    if ( notify ) ui.notifications.warn(_loc("SVPS.Notify.SelectTokens", {name: actor.name}));
    return null;
  }

  const before = poseState(origin ?? (linked ? actor : tokens[0]));
  const src = pose?.src ?? actor.img;
  let aspect = null;
  if ( pose ) {
    aspect = await imageAspect(src);
    if ( !aspect ) {
      if ( notify ) ui.notifications.error(_loc("SVPS.Notify.MissingImage", {src}));
      return null;
    }
    await rememberAspect(actor, pose, aspect);
  }

  // Token updates, grouped by scene
  const base = actor.flags?.ember?.portrait ?? {};
  const portrait = posePortrait(base, pose, aspect);
  const state = {pose: pose?.id ?? null};
  const byScene = new Map();
  for ( const token of tokens ) {
    const from = cleanPortrait(token.flags?.ember?.portrait ?? base);
    const size = scaledSize(token._source, from, portrait);
    const updates = byScene.get(token.parent) ?? [];
    updates.push({
      _id: token.id,
      texture: {src, scaleX: flippedScaleX(token._source.texture.scaleX, from.flip, portrait.flip)},
      width: size.width,
      height: size.height,
      flags: {ember: {portrait}, [MODULE_ID]: state}
    });
    byScene.set(token.parent, updates);
  }
  const options = updateOptions();
  let changed = 0;
  for ( const [scene, updates] of byScene ) {
    try {
      await scene.updateEmbeddedDocuments("Token", updates, options);
      changed += updates.length;
    } catch(err) {
      console.error(`${MODULE_ID} | Could not change the tokens of ${actor.name} in ${scene.name}`, err);
      ui.notifications.error(_loc("SVPS.Notify.UpdateFailed", {scene: scene.name}));
    }
  }

  // The character keeps its pose for new tokens
  if ( linked ) {
    await actor.update({[`flags.${MODULE_ID}`]: state});
    if ( notify && !tokens.length ) ui.notifications.info(_loc("SVPS.Notify.NoTokens", {name: actor.name}));
  }

  if ( changed && setting("chatNotice") && (before.pose !== state.pose) ) {
    await announce(actor, origin ?? tokens[0], pose, src);
  }
  return {tokens: changed};
}

/* -------------------------------------------- */

/**
 * Keep the measured proportions of an image with its pose, if they were not known yet.
 * @param {Actor} actor
 * @param {import("./poses.mjs").VistaPose} pose
 * @param {number} aspect
 */
async function rememberAspect(actor, pose, aspect) {
  if ( (pose.aspect && (Math.abs(pose.aspect - aspect) < 0.001)) || !actor.isOwner ) return;
  const poses = getPoses(actor).map(p => (p.id === pose.id) ? {...p, aspect} : p);
  await actor.update({[`flags.${MODULE_ID}.poses`]: poses});
}

/* -------------------------------------------- */

/**
 * Post a short note about the new portrait to the chat.
 * @param {Actor} actor
 * @param {TokenDocument|undefined} token
 * @param {import("./poses.mjs").VistaPose|null} pose
 * @param {string} src
 */
async function announce(actor, token, pose, src) {
  const escape = foundry.utils.escapeHTML;
  const name = token?.name ?? actor.name;
  const label = pose ? pose.label : _loc("SVPS.OwnPortrait");
  const text = _loc("SVPS.Chat.Changed", {name: escape(name), pose: escape(label)});
  const content = `<div class="svps-chat"><img src="${escape(src)}" alt=""><span>${text}</span></div>`;
  const cls = foundry.documents.ChatMessage.implementation;
  await cls.create({speaker: cls.getSpeaker({actor, token}), content});
}

/* -------------------------------------------- */

/**
 * Show the next or previous pose.
 * @param {Token|TokenDocument|Actor|string} target
 * @param {number} step     +1 or -1
 * @returns {Promise<{tokens: number}|null>}
 */
export function stepPose(target, step) {
  const actor = resolveTarget(target)?.actor;
  if ( !actor ) return Promise.resolve(null);
  const next = cyclePose(getPoses(actor), currentState(target).pose, step);
  if ( !next ) return Promise.resolve(null);
  return applyPose(target, next);
}

/* -------------------------------------------- */

/**
 * The state that a switch on this target starts from.
 * @param {Token|TokenDocument|Actor|string} target
 * @returns {{pose: string|null}}
 */
function currentState(target) {
  const resolved = resolveTarget(target);
  if ( !resolved ) return {pose: null};
  const {actor, linked, tokens, origin} = resolved;
  return poseState(origin ?? (linked ? actor : (tokens[0] ?? actor)));
}

/* -------------------------------------------- */

/**
 * The usable poses of the actor behind a token or actor.
 * @param {Token|TokenDocument|Actor} target
 * @returns {import("./poses.mjs").VistaPose[]}
 */
export function posesOf(target) {
  return usablePoses(getPoses(galleryActor(target)));
}

/* -------------------------------------------- */
/*  New tokens                                  */
/* -------------------------------------------- */

/**
 * A character placed in a Vista starts with its current pose. Ember replaces the token image by the actor's
 * portrait and sizes the token from `flags.ember.portrait`; this hook runs first and hands Ember the pose instead.
 * If Ember already processed the token, its size is scaled to the pose.
 * @param {TokenDocument} document
 * @param {object} data
 */
export function onPreCreateToken(document, data) {
  if ( !setting("newTokens") || !isVistaScene(document.parent) ) return;
  const actor = galleryActor(document);
  if ( !actor || !document.actorLink ) return;
  const pose = findPose(getPoses(actor), poseState(actor).pose);
  if ( !pose ) return;
  const prototypeSrc = actor.prototypeToken.texture.src;
  const emberDone = foundry.utils.hasProperty(data, "flags.ember.portrait");
  const src = document.texture.src;
  if ( (src !== prototypeSrc) && !(emberDone && (src === actor.img)) ) return; // A custom image wins

  const base = actor.flags?.ember?.portrait ?? {};
  const portrait = posePortrait(base, pose, pose.aspect);
  const changes = {
    texture: {src: pose.src},
    flags: {ember: {portrait}, [MODULE_ID]: {pose: pose.id}}
  };
  if ( emberDone ) {
    const from = cleanPortrait(document.flags.ember?.portrait ?? base);
    Object.assign(changes, scaledSize(document._source, from, portrait));
    changes.texture.scaleX = flippedScaleX(document._source.texture.scaleX, from.flip, portrait.flip);
  }
  document.updateSource(changes);
  // Ember applies the creation data to the document afterwards; it must carry the pose too
  foundry.utils.mergeObject(data, changes);
}
