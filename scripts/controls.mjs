/**
 * Ways to reach the gallery outside the token HUD: the actor sheet header and the actor directory's context menu.
 */

import {openGallery} from "./gallery.mjs";
import {canEdit, canSwitch, galleryActor, posesOf} from "./vista.mjs";

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
