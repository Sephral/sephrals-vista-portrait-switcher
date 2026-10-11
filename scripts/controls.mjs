/**
 * Ways to reach the gallery and the poses outside the token HUD: hotkeys, the actor sheet header and the actor
 * directory's context menu.
 */

import {openGallery} from "./gallery.mjs";
import {
  applyPose, canEdit, canSwitch, galleryActor, isVistaScene, posesOf, stepPose, toggleLight
} from "./vista.mjs";

/* -------------------------------------------- */
/*  Hotkeys                                     */
/* -------------------------------------------- */

/**
 * What a hotkey acts on while a Vista is viewed: the controlled tokens, or else the user's own character.
 * A linked character is only listed once, because a switch reaches all of its tokens.
 * @returns {(TokenDocument|Actor)[]}
 */
export function hotkeyTargets() {
  if ( !isVistaScene(canvas?.scene) ) return [];
  const targets = [];
  const characters = new Set();
  for ( const token of canvas.tokens?.controlled ?? [] ) {
    const actor = galleryActor(token);
    if ( !actor || !canSwitch(actor) ) continue;
    if ( token.document.actorLink ) {
      if ( characters.has(actor.id) ) continue;
      characters.add(actor.id);
    }
    targets.push(token.document);
  }
  if ( targets.length ) return targets;
  const character = game.user.character;
  return (character && canSwitch(character)) ? [character] : [];
}

/**
 * Show pose number n.
 * @param {(TokenDocument|Actor)[]} targets
 * @param {number} n
 */
export function onPoseHotkey(targets, n) {
  for ( const target of targets ) {
    const pose = posesOf(target)[n - 1];
    if ( pose ) applyPose(target, pose.id);
  }
}

/**
 * Show the actor's own portrait.
 * @param {(TokenDocument|Actor)[]} targets
 */
export function onResetHotkey(targets) {
  for ( const target of targets ) applyPose(target, null);
}

/**
 * Show the next or previous pose.
 * @param {(TokenDocument|Actor)[]} targets
 * @param {number} step
 */
export function onStepHotkey(targets, step) {
  for ( const target of targets ) stepPose(target, step);
}

/**
 * Switch the light variants.
 * @param {(TokenDocument|Actor)[]} targets
 */
export function onLightHotkey(targets) {
  for ( const target of targets ) toggleLight(target);
}

/**
 * Open the gallery of the first target.
 * @param {(TokenDocument|Actor)[]} targets
 */
export function onGalleryHotkey(targets) {
  openGallery(galleryActor(targets[0]));
}

/* -------------------------------------------- */
/*  Sheet header and actor directory            */
/* -------------------------------------------- */

/**
 * May the current user open the gallery of this actor?
 * @param {Actor|null} actor
 * @returns {boolean}
 */
function canOpen(actor) {
  if ( !actor || actor.pack ) return false;
  return canEdit(actor) || (canSwitch(actor) && (posesOf(actor).length > 0));
}

/**
 * Add "Vista portraits" to the header menu of actor sheets.
 * @param {foundry.applications.api.ApplicationV2} app
 * @param {object[]} controls
 */
export function addHeaderControl(app, controls) {
  const actor = galleryActor(app.document);
  if ( !canOpen(actor) ) return;
  controls.push({
    icon: "fa-solid fa-masks-theater",
    label: "SVPS.Gallery.Open",
    action: "svpsOpenGallery",
    onClick: () => openGallery(actor)
  });
}

/**
 * Add "Vista portraits" to the context menu of the actor directory.
 * @param {foundry.applications.sidebar.tabs.ActorDirectory} app
 * @param {object[]} options
 */
export function addContextOptions(app, options) {
  const actorOf = li => game.actors.get(li.closest("[data-entry-id]")?.dataset.entryId);
  options.push({
    label: "SVPS.Gallery.Open",
    icon: "fa-solid fa-masks-theater",
    visible: li => canOpen(actorOf(li)),
    onClick: (event, li) => openGallery(actorOf(li))
  });
}
