import {MODULE_ID} from "./config.mjs";
import {addContextOptions, addHeaderControl} from "./controls.mjs";
import {PortraitGallery, openGallery, refreshGalleries} from "./gallery.mjs";
import {onRenderTokenHUD} from "./hud.mjs";
import {registerKeybindings, registerSettings} from "./settings.mjs";
import {
  applyPose, getPoses, isVistaScene, onPreCreateToken, poseState, posesOf, resolveTarget, savePoses, stepPose,
  toggleLight
} from "./vista.mjs";

Hooks.once("init", () => {
  registerSettings();
  registerKeybindings();

  Hooks.on("renderTokenHUD", onRenderTokenHUD);
  Hooks.on("preCreateToken", onPreCreateToken);
  Hooks.on("getHeaderControlsActorSheetV2", addHeaderControl);
  Hooks.on("getActorContextOptions", addContextOptions);
  Hooks.on("updateActor", onUpdateActor);

  game.modules.get(MODULE_ID).api = {
    /** Show a pose (id, name or number; null = the actor's own portrait) on a token or character. */
    setPose: (target, pose, options) => applyPose(target, pose, options),
    /** Show the actor's own portrait again. */
    resetPose: target => applyPose(target, null),
    /** Show the next (+1) or previous (-1) pose. */
    stepPose,
    /** Switch the light variants on or off (or to the given state). */
    toggleLight,
    /** The gallery of an actor. */
    getPoses,
    /** Store a gallery on an actor. */
    savePoses,
    /** The usable poses of a token or actor. */
    posesOf,
    /** The current pose and light of a token or character. */
    poseState,
    /** Which actor and tokens a switch on this target reaches. */
    resolveTarget,
    /** Open the gallery window of an actor. */
    openGallery,
    /** Is this scene an Ember Vista? */
    isVistaScene,
    PortraitGallery
  };
});

/* -------------------------------------------- */

/**
 * Keep open galleries and the token HUD current when a gallery or the actor's portrait changes.
 * @param {Actor} actor
 * @param {object} changes
 */
function onUpdateActor(actor, changes) {
  const relevant = ("img" in changes) || foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`)
    || foundry.utils.hasProperty(changes, "flags.ember.portrait") || ("prototypeToken" in changes)
    || ("ownership" in changes);
  if ( !relevant ) return;
  refreshGalleries(actor);
  const hud = canvas?.hud?.token;
  if ( hud?.rendered && (hud.document?.baseActor === actor) ) hud.render();
}
