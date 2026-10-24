/**
 * The portrait gallery of a character: add images or whole folders, name the portraits, give them a figure height
 * and mirroring, sort them – and switch to a portrait with a click.
 */

import {MODULE_ID, TEMPLATES, addSettingsGear, makeId} from "./config.mjs";
import {alternateFiles, cleanPortrait, fileStem, posesFromFiles} from "./poses.mjs";
import {countFeature} from "./usage.mjs";
import {applyPose, canEdit, canSwitch, getPoses, poseState, savePoses} from "./vista.mjs";

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
  countFeature(MODULE_ID, "galleryOpened");
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
      addImage: PortraitGallery.#onAddImage,
      importFolder: PortraitGallery.#onImportFolder,
      suggest: PortraitGallery.#onSuggest,
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
    const state = linked ? poseState(actor) : {pose: null};
    return {
      actor: {name: actor.name, img: actor.img},
      editable: canEdit(actor),
      switchable: canSwitch(actor),
      browse: game.user.can("FILES_BROWSE"),
      linked,
      ownActive: linked && !poses.some(p => p.src && (p.id === state.pose)),
      baseHeight: cleanPortrait(actor.flags?.ember?.portrait).height,
      poses: poses.map((pose, index) => ({
        ...pose,
        index,
        first: index === 0,
        last: index === (poses.length - 1),
        active: linked && (pose.id === state.pose),
        thumb: pose.src
      }))
    };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    addSettingsGear(frame);
    return frame;
  }

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
   * Add image files to the gallery, one portrait per image.
   * @param {string[]} paths
   * @returns {Promise<number>}  The number of new portraits
   */
  async #addFiles(paths) {
    const existing = getPoses(this.actor);
    const added = posesFromFiles(paths, {existing, makeId, preferred: this.actor.img});
    if ( !added.length ) {
      ui.notifications.info(_loc("SVPS.Gallery.NothingNew"));
      return 0;
    }
    await savePoses(this.actor, existing.concat(added));
    countFeature(MODULE_ID, "imagesAdded");
    ui.notifications.info(_loc("SVPS.Gallery.Added", {poses: added.length}));
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
    if ( !id ) return;
    countFeature(MODULE_ID, "gallerySwitch");
    await applyPose(this.actor, id);
  }

  /**
   * Show the actor's own portrait.
   * @this {PortraitGallery}
   */
  static async #onReset() {
    countFeature(MODULE_ID, "gallerySwitch");
    await applyPose(this.actor, null);
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
   * Pick a folder and add all its images.
   * @this {PortraitGallery}
   */
  static #onImportFolder() {
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    const current = getPoses(this.actor).at(-1)?.src ?? this.actor.img;
    const picker = new FilePicker({
      type: "folder",
      current: current?.split("/").slice(0, -1).join("/"),
      callback: async path => {
        countFeature(MODULE_ID, "folderImport");
        try {
          const files = await browseImages(picker.activeSource, path, picker.source?.bucket);
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
   * Look for variants of the actor's portrait and token image next to them and add the ones the user picks.
   * @this {PortraitGallery}
   */
  static async #onSuggest() {
    if ( !game.user.can("FILES_BROWSE") ) return;
    countFeature(MODULE_ID, "suggestVariants");
    const {files, failed} = await findAlternates(this.actor, getPoses(this.actor));
    if ( !files.length ) {
      if ( failed.length ) ui.notifications.error(_loc("SVPS.Gallery.FolderFailed", {path: failed.join(", ")}));
      else ui.notifications.info(_loc("SVPS.Suggest.None"));
      return;
    }
    const picked = await pickAlternates(this.actor, files);
    if ( picked.length ) await this.#addFiles(picked);
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

/* -------------------------------------------- */

/**
 * The image files of a folder.
 * @param {string} source       A file source of Foundry's file picker ("data", "s3", "forgevtt" …)
 * @param {string} target       The folder within the source
 * @param {string} [bucket]     The bucket of an S3 source
 * @returns {Promise<string[]>}
 */
async function browseImages(source, target, bucket) {
  const FilePicker = foundry.applications.apps.FilePicker.implementation;
  const extensions = imageExtensions();
  const options = {extensions};
  if ( (source === "s3") && bucket ) options.bucket = bucket;
  const result = await FilePicker.browse(source, target, options);
  return (result.files ?? []).filter(f => extensions.some(e => f.toLowerCase().endsWith(e)));
}

/* -------------------------------------------- */

/**
 * Images next to the actor's portrait and its token image whose names continue theirs ("merchant-angry.webp" next
 * to "merchant.webp"). The file picker works out source and folder of each image, as it does when it opens on it.
 * @param {Actor} actor
 * @param {import("./poses.mjs").VistaPose[]} existing    Poses already in the gallery
 * @returns {Promise<{files: string[], failed: string[]}>}  The variants and the folders which could not be read
 */
async function findAlternates(actor, existing) {
  const token = actor.prototypeToken;
  const references = [...new Set([actor.img, token.randomImg ? null : token.texture.src])]
    .filter(src => src && (src !== CONST.DEFAULT_TOKEN) && !src.includes("*"));
  const FilePicker = foundry.applications.apps.FilePicker.implementation;
  const files = [];
  const failed = [];
  const browsed = new Set();
  for ( const src of references ) {
    let target = src.split("/").slice(0, -1).join("/");
    try {
      const picker = new FilePicker({type: "image", current: src}); // Never rendered
      const source = picker.activeSource;
      const bucket = picker.source?.bucket;
      target = picker.source?.target ?? "";
      if ( !target && src.includes("/") ) continue; // An address the file picker cannot browse
      const key = `${source}:${bucket ?? ""}:${target}`;
      if ( browsed.has(key) ) continue;
      browsed.add(key);
      files.push(...await browseImages(source, target, bucket));
    } catch(err) {
      console.warn(`${MODULE_ID} | Could not read the folder of ${src}`, err);
      failed.push(target);
    }
  }
  return {files: alternateFiles(files, references, {existing}), failed};
}

/* -------------------------------------------- */

/**
 * Let the user tick the variants to add.
 * @param {Actor} actor
 * @param {string[]} files
 * @returns {Promise<string[]>}  The ticked files, none if the dialog was closed
 */
async function pickAlternates(actor, files) {
  const escape = foundry.utils.escapeHTML;
  const items = files.map(src => `<label class="svps-suggestion" data-tooltip="${escape(src)}">
    <input type="checkbox" name="files" value="${escape(src)}" checked>
    <img src="${escape(src)}" alt="" loading="lazy" decoding="async">
    <span>${escape(fileStem(src))}</span></label>`);
  const content = document.createElement("div");
  content.innerHTML = `<p class="hint">${escape(_loc("SVPS.Suggest.Intro"))}</p>
    <div class="svps-suggestions">${items.join("")}</div>`;
  const picked = await foundry.applications.api.DialogV2.wait({
    window: {title: _loc("SVPS.Suggest.Title", {name: actor.name}), icon: "fa-solid fa-wand-magic-sparkles"},
    classes: ["svps-suggest"],
    position: {width: 560},
    content,
    buttons: [{
      action: "add", label: "SVPS.Suggest.Add", icon: "fa-solid fa-plus", default: true,
      callback: (event, button) => Array.from(button.form.querySelectorAll('input[name="files"]:checked'), i => i.value)
    }, {
      action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark"
    }]
  });
  return Array.isArray(picked) ? picked : [];
}
