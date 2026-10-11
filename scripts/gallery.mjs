/**
 * The portrait gallery of a character: add images or whole folders, name the poses, give them a light variant,
 * a figure height and mirroring, sort them – and switch to a pose with a click.
 */

import {MODULE_ID, POSE_HOTKEYS, TEMPLATES, makeId} from "./config.mjs";
import {cleanPortrait, posesFromFiles} from "./poses.mjs";
import {applyPose, canEdit, canSwitch, getPoses, poseState, savePoses, toggleLight} from "./vista.mjs";

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

/**
 * Open the gallery of an actor, or bring an open one to the front.
 * @param {Actor} actor
 * @returns {PortraitGallery|null}
 */
export function openGallery(actor) {
  if ( !actor ) return null;
  if ( !canEdit(actor) && !canSwitch(actor) ) {
    ui.notifications.warn(_loc("SVPS.Notify.NoPermission", {name: actor.name}));
    return null;
  }
  const existing = foundry.applications.instances.get(PortraitGallery.idFor(actor));
  const app = existing ?? new PortraitGallery({actor});
  app.render({force: true});
  return app;
}

/* -------------------------------------------- */

/**
 * Re-render the open galleries of an actor.
 * @param {Actor} actor
 */
export function refreshGalleries(actor) {
  const app = foundry.applications.instances.get(PortraitGallery.idFor(actor));
  if ( app?.rendered ) app.render();
}

/* -------------------------------------------- */

/**
 * The gallery window of one actor.
 */
export class PortraitGallery extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options
   * @param {Actor} options.actor
   */
  constructor({actor, ...options}={}) {
    super({id: PortraitGallery.idFor(actor), ...options});
    this.actor = actor;
  }

  /**
   * The application id of an actor's gallery.
   * @param {Actor} actor
   * @returns {string}
   */
  static idFor(actor) {
    return `${MODULE_ID}-gallery-${actor.id}`;
  }

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["svps-gallery"],
    window: {icon: "fa-solid fa-masks-theater", resizable: true},
    position: {width: 780, height: 680},
    form: {handler: PortraitGallery.#onSubmit, submitOnChange: true, closeOnSubmit: false},
    actions: {
      apply: PortraitGallery.#onApply,
      reset: PortraitGallery.#onReset,
      light: PortraitGallery.#onLight,
      addImage: PortraitGallery.#onAddImage,
      importFolder: PortraitGallery.#onImportFolder,
      moveUp: PortraitGallery.#onMove,
      moveDown: PortraitGallery.#onMove,
      remove: PortraitGallery.#onRemove
    }
  };

  /** @override */
  static PARTS = {
    gallery: {template: `${TEMPLATES}/gallery.hbs`, scrollable: [".svps-cards"]}
  };

  /** @override */
  get title() {
    return _loc("SVPS.Gallery.Title", {name: this.actor.name});
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext() {
    const actor = this.actor;
    const poses = getPoses(actor);
    const linked = actor.prototypeToken.actorLink;
    const state = linked ? poseState(actor) : {pose: null, light: false};
    let hotkey = 0;
    return {
      actor: {name: actor.name, img: actor.img},
      editable: canEdit(actor),
      switchable: canSwitch(actor),
      browse: game.user.can("FILES_BROWSE"),
      linked,
      light: state.light,
      ownActive: linked && !poses.some(p => p.src && (p.id === state.pose)),
      hasLight: poses.some(p => p.lightSrc),
      baseHeight: cleanPortrait(actor.flags?.ember?.portrait).height,
      poses: poses.map((pose, index) => ({
        ...pose,
        index,
        first: index === 0,
        last: index === (poses.length - 1),
        active: linked && (pose.id === state.pose),
        thumb: (state.light && pose.lightSrc) ? pose.lightSrc : pose.src,
        key: (pose.src && (hotkey < POSE_HOTKEYS)) ? ++hotkey : null
      }))
    };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.element.addEventListener("dragover", event => event.preventDefault());
    this.element.addEventListener("drop", this.#onDrop.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Add an image dropped from Foundry's file browser (GM, tiles layer).
   * @param {DragEvent} event
   */
  async #onDrop(event) {
    if ( !canEdit(this.actor) ) return;
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    const src = data?.texture?.src ?? data?.src;
    if ( (typeof src !== "string") || !src ) return;
    event.preventDefault();
    await this.#addFiles([src]);
  }

  /* -------------------------------------------- */

  /**
   * Add image files to the gallery: new poses, and light variants of poses already there.
   * @param {string[]} paths
   * @returns {Promise<number>}  The number of new poses
   */
  async #addFiles(paths) {
    const existing = getPoses(this.actor);
    const {added, attached} = posesFromFiles(paths, {existing, makeId, preferred: this.actor.img});
    if ( !added.length && !attached.length ) {
      ui.notifications.info(_loc("SVPS.Gallery.NothingNew"));
      return 0;
    }
    const poses = existing.map(pose => {
      const light = attached.find(a => a.id === pose.id);
      return light ? {...pose, lightSrc: light.lightSrc} : pose;
    }).concat(added);
    await savePoses(this.actor, poses);
    ui.notifications.info(_loc("SVPS.Gallery.Added", {poses: added.length, light: attached.length}));
    return added.length;
  }

  /* -------------------------------------------- */

  /**
   * Save the edited poses.
   * @this {PortraitGallery}
   * @param {SubmitEvent} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static async #onSubmit(event, form, formData) {
    if ( !canEdit(this.actor) ) return;
    const rows = foundry.utils.expandObject(formData.object).poses;
    if ( !rows ) return;
    const stored = getPoses(this.actor);
    const poses = Object.keys(rows).sort((a, b) => Number(a) - Number(b)).map(key => {
      const row = rows[key];
      const old = stored.find(p => p.id === row.id) ?? {};
      return {...old, ...row, mirror: !!row.mirror};
    });
    await savePoses(this.actor, poses);
  }

  /* -------------------------------------------- */

  /**
   * Show a pose.
   * @this {PortraitGallery}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onApply(event, target) {
    const id = target.closest("[data-pose-id]")?.dataset.poseId;
    if ( id ) await applyPose(this.actor, id);
  }

  /**
   * Show the actor's own portrait.
   * @this {PortraitGallery}
   */
  static async #onReset() {
    await applyPose(this.actor, null);
  }

  /**
   * Switch the light variants on or off.
   * @this {PortraitGallery}
   */
  static async #onLight() {
    await toggleLight(this.actor);
  }

  /* -------------------------------------------- */

  /**
   * Pick one image and add it. Users who may not browse files get an empty pose to type the path into.
   * @this {PortraitGallery}
   */
  static async #onAddImage() {
    if ( !game.user.can("FILES_BROWSE") ) {
      const poses = getPoses(this.actor).concat({label: _loc("SVPS.Gallery.NewPose"), src: ""});
      await savePoses(this.actor, poses);
      return;
    }
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    new FilePicker({
      type: "image",
      current: getPoses(this.actor).at(-1)?.src ?? this.actor.img,
      callback: path => this.#addFiles([path])
    }).render({force: true});
  }

  /* -------------------------------------------- */

  /**
   * Pick a folder and add all its images; "-licht"/"-light" files become light variants.
   * @this {PortraitGallery}
   */
  static #onImportFolder() {
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    const current = getPoses(this.actor).at(-1)?.src ?? this.actor.img;
    const picker = new FilePicker({
      type: "folder",
      current: current?.split("/").slice(0, -1).join("/"),
      callback: async path => {
        try {
          const result = await FilePicker.browse(picker.activeSource, path, {extensions: imageExtensions()});
          const files = (result.files ?? []).filter(f => imageExtensions().some(e => f.toLowerCase().endsWith(e)));
          if ( !files.length ) {
            ui.notifications.warn(_loc("SVPS.Gallery.NoImages", {path}));
            return;
          }
          await this.#addFiles(files);
        } catch(err) {
          console.error(`${MODULE_ID} | Could not read the folder ${path}`, err);
          ui.notifications.error(_loc("SVPS.Gallery.FolderFailed", {path}));
        }
      }
    });
    picker.render({force: true});
  }

  /* -------------------------------------------- */

  /**
   * Move a pose up or down.
   * @this {PortraitGallery}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onMove(event, target) {
    const index = Number(target.closest("[data-index]")?.dataset.index);
    const poses = getPoses(this.actor);
    const other = index + ((target.dataset.action === "moveUp") ? -1 : 1);
    if ( !poses[index] || !poses[other] ) return;
    [poses[index], poses[other]] = [poses[other], poses[index]];
    await savePoses(this.actor, poses);
  }

  /**
   * Remove a pose from the gallery (the image file stays).
   * @this {PortraitGallery}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onRemove(event, target) {
    const id = target.closest("[data-pose-id]")?.dataset.poseId;
    const poses = getPoses(this.actor).filter(p => p.id !== id);
    await savePoses(this.actor, poses);
  }
}

/* -------------------------------------------- */

/**
 * The file extensions of images Foundry accepts, with a leading dot.
 * @returns {string[]}
 */
function imageExtensions() {
  return Object.keys(CONST.IMAGE_FILE_EXTENSIONS).map(e => `.${e}`);
}
