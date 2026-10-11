import {MODULE_ID} from "./config.mjs";
import {addContextOptions, addHeaderControl} from "./controls.mjs";
import {PortraitGallery, openGallery, refreshGalleries} from "./gallery.mjs";
import {onRenderTokenHUD} from "./hud.mjs";
import {applyModuleLanguage} from "./language.mjs";
import {noticeNewVersions, runSelfTest} from "./selftest.mjs";
import {openSettings, registerSettings} from "./settings.mjs";
import {
  applyPose, getPoses, isVistaScene, onPreCreateToken, poseState, posesOf, resolveTarget, savePoses, stepPose
} from "./vista.mjs";

Hooks.once("init", () => {
  registerSettings();

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
    /** The gallery of an actor. */
    getPoses,
    /** Store a gallery on an actor. */
    savePoses,
    /** The usable poses of a token or actor. */
    posesOf,
    /** The current pose of a token or character. */
    poseState,
    /** Which actor and tokens a switch on this target reaches. */
    resolveTarget,
    /** Open the gallery window of an actor. */
    openGallery,
    /** Is this scene an Ember Vista? */
    isVistaScene,
    /** Open Foundry's settings dialog on the page of this module. */
    openSettings,
    /** Check the Ember integration and every gallery image (GM). */
    runSelfTest,
    PortraitGallery
  };
});

/** Applying a fixed module language loads its file; the version notice waits for it. */
let languageReady = Promise.resolve();

Hooks.once("i18nInit", () => {
  languageReady = applyModuleLanguage(game.settings.get(MODULE_ID, "uiLanguage"));
});

Hooks.once("ready", async () => {
  await languageReady;
  noticeNewVersions();
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
