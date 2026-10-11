/**
 * The pose palette in the token HUD: right-click a character in a Vista, open the palette with the mask button and
 * click a portrait.
 */

import {PALETTE_ID, POSE_HOTKEYS, setting} from "./config.mjs";
import {openGallery} from "./gallery.mjs";
import {usablePoses} from "./poses.mjs";
import {applyPose, canEdit, canSwitch, galleryActor, getPoses, isVistaScene, poseState, toggleLight} from "./vista.mjs";

/**
 * Add the mask button and its palette to the token HUD of a Vista token.
 * @param {foundry.applications.hud.TokenHUD} hud
 * @param {HTMLElement} element
 */
export function onRenderTokenHUD(hud, element) {
  const token = hud.document;
  if ( !setting("hudButton") || !isVistaScene(token?.parent) ) return;
  const actor = galleryActor(token);
  if ( !actor ) return;
  const poses = usablePoses(getPoses(actor));
  const switchable = canSwitch(actor);
  const editable = canEdit(actor);
  if ( !(switchable && poses.length) && !editable ) return;
  const column = element.querySelector(".col.right");
  if ( !column || column.querySelector(`[data-palette="${PALETTE_ID}"]`) ) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "control-icon svps-hud-button";
  button.dataset.action = "togglePalette";
  button.dataset.palette = PALETTE_ID;
  button.dataset.tooltip = "";
  button.setAttribute("aria-label", _loc("SVPS.HUD.Button"));
  button.innerHTML = '<i class="fa-solid fa-masks-theater" inert></i>';

  const palette = document.createElement("div");
  palette.className = "palette svps-palette";
  palette.dataset.palette = PALETTE_ID;
  palette.innerHTML = paletteHTML(token, actor, poses, {switchable, editable});
  palette.addEventListener("click", event => onPaletteClick(event, hud, token, actor));
  column.append(button, palette);
}

/* -------------------------------------------- */

/**
 * The content of the palette.
 * @param {TokenDocument} token
 * @param {Actor} actor
 * @param {import("./poses.mjs").VistaPose[]} poses
 * @param {{switchable: boolean, editable: boolean}} permissions
 * @returns {string}
 */
function paletteHTML(token, actor, poses, {switchable, editable}) {
  const escape = foundry.utils.escapeHTML;
  const {pose: current, light} = poseState(token);
  const currentPose = poses.find(p => p.id === current);
  const disabled = switchable ? "" : " disabled";
  const tool = (action, icon, label, active=false) => `<button type="button" class="svps-tool${active ? " active" : ""}"
    data-svps="${action}" data-tooltip aria-label="${escape(_loc(label))}"${(action === "gallery") ? "" : disabled}>
    <i class="${icon}" inert></i></button>`;

  const tools = [];
  if ( poses.some(p => p.lightSrc) ) tools.push(tool("light", "fa-solid fa-lightbulb", "SVPS.HUD.Light", light));
  tools.push(tool("reset", "fa-solid fa-user", "SVPS.HUD.Reset", !currentPose));
  if ( editable ) tools.push(tool("gallery", "fa-solid fa-images", "SVPS.HUD.Gallery"));

  const cards = poses.map((pose, i) => {
    const src = (light && pose.lightSrc) ? pose.lightSrc : pose.src;
    const key = (i < POSE_HOTKEYS) ? `<span class="svps-key">${i + 1}</span>` : "";
    return `<button type="button" class="svps-pose${(pose.id === current) ? " active" : ""}" data-svps="pose"
      data-pose-id="${pose.id}" data-tooltip="${escape(pose.label)}"${disabled}>
      <img src="${escape(src)}" alt="" loading="lazy"${pose.mirror ? ' class="svps-mirrored"' : ""}>${key}
      <span class="svps-pose-label">${escape(pose.label)}</span></button>`;
  }).join("");
  const columns = Math.min(4, Math.max(1, poses.length));
  const body = cards ? `<div class="svps-palette-grid" style="--svps-columns: ${columns}">${cards}</div>`
    : `<p class="svps-empty">${escape(_loc("SVPS.HUD.Empty"))}</p>`;
  return `<div class="svps-palette-head"><span class="svps-palette-title">${escape(actor.name)}</span>
    ${tools.join("")}</div>${body}`;
}

/* -------------------------------------------- */

/**
 * Handle a click in the palette.
 * @param {PointerEvent} event
 * @param {foundry.applications.hud.TokenHUD} hud
 * @param {TokenDocument} token
 * @param {Actor} actor
 */
async function onPaletteClick(event, hud, token, actor) {
  const target = event.target.closest("[data-svps]");
  if ( !target || target.disabled ) return;
  event.preventDefault();
  event.stopPropagation();
  if ( target.dataset.svps !== "gallery" ) reopenAfterRedraw(hud, token);
  switch ( target.dataset.svps ) {
    case "pose":
      await applyPose(token, target.dataset.poseId);
      break;
    case "reset":
      await applyPose(token, null);
      break;
    case "light":
      await toggleLight(token);
      break;
    case "gallery":
      hud.togglePalette(PALETTE_ID, false);
      openGallery(actor);
      return;
  }
  refreshPalette(hud, token, actor);
}

/* -------------------------------------------- */

/**
 * A new texture makes Foundry redraw the token at the end of its transition, which closes the HUD. Reopen it with
 * the palette, so the next portrait is one click away.
 * @param {foundry.applications.hud.TokenHUD} hud
 * @param {TokenDocument} token
 */
function reopenAfterRedraw(hud, token) {
  pendingReopen?.cancel();
  let timeout;
  const hookId = Hooks.on("drawToken", async placeable => {
    if ( placeable.document !== token ) return;
    pendingReopen.cancel();
    if ( (hud.rendered && (hud.document !== token)) || (placeable.scene !== canvas.scene) ) return;
    await hud.bind(placeable);
    hud.togglePalette(PALETTE_ID, true);
  });
  pendingReopen = {cancel: () => {
    Hooks.off("drawToken", hookId);
    clearTimeout(timeout);
    pendingReopen = null;
  }};
  timeout = setTimeout(() => pendingReopen?.cancel(), 10000);
}

/** The reopening that waits for the next redraw, if any. */
let pendingReopen = null;

/* -------------------------------------------- */

/**
 * Update the palette in place after a switch, if the HUD did not re-render on its own.
 * @param {foundry.applications.hud.TokenHUD} hud
 * @param {TokenDocument} token
 * @param {Actor} actor
 */
function refreshPalette(hud, token, actor) {
  const palette = hud.element?.querySelector(`.palette[data-palette="${PALETTE_ID}"]`);
  if ( !palette || (hud.document !== token) ) return;
  const poses = usablePoses(getPoses(actor));
  palette.innerHTML = paletteHTML(token, actor, poses, {switchable: canSwitch(actor), editable: canEdit(actor)});
}

/* -------------------------------------------- */

/**
 * Re-render an open token HUD, e.g. after a setting changed.
 */
export function refreshTokenHUD() {
  const hud = canvas?.hud?.token;
  if ( !hud?.rendered ) return;
  if ( hud.activePalette === PALETTE_ID ) hud.togglePalette(null);
  hud.render();
}
