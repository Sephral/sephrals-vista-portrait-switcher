/**
 * Pure helpers for portrait galleries: normalizing stored poses, turning image files into poses and the portrait
 * math of Ember Vistas. Nothing here touches Foundry globals, so the helpers also run in Node tests.
 */

/**
 * @typedef VistaPose
 * @property {string} id                 Stable id of the pose
 * @property {string} label              Name shown in the palette and the gallery
 * @property {string} src                Image path
 * @property {number|null} height        Figure height in feet, null = the actor's portrait height
 * @property {boolean} mirror            Mirror this image relative to the actor's portrait
 * @property {number|null} aspect        Width / height of `src`, cached for synchronous use
 */

/**
 * Ember's defaults for the portrait of an actor in a Vista (feet).
 * @type {Readonly<{height: number, width: number, anchorX: number, anchorY: number, flip: boolean}>}
 */
export const DEFAULT_PORTRAIT = Object.freeze({height: 6, width: 3, anchorX: 0.5, anchorY: 1, flip: false});

/** Ember stores portrait sizes in steps of half a foot, starting at one foot. */
const SIZE_STEP = 0.5;
const SIZE_MIN = 1;

/* -------------------------------------------- */
/*  Poses                                       */
/* -------------------------------------------- */

/**
 * The file name of a path without folder, query and extension.
 * @param {string} path
 * @returns {string}
 */
export function fileStem(path) {
  const name = String(path ?? "").split(/[\\/]/).pop().split("?")[0];
  let stem = name.replace(/\.[^.]+$/, "");
  try {
    stem = decodeURIComponent(stem);
  } catch {
    // Keep the raw name if it is not valid URI encoding
  }
  return stem;
}

/* -------------------------------------------- */

/**
 * A path without its query (Foundry adds "?<timestamp>" to refreshed images).
 * @param {string|null} path
 * @returns {string}
 */
export function withoutQuery(path) {
  return String(path ?? "").split("?")[0];
}

/* -------------------------------------------- */

/**
 * The longest common beginning of several names, cut back to the last separator ("mira-vista-").
 * @param {string[]} stems
 * @returns {string}
 */
export function commonPrefix(stems) {
  if ( stems.length < 2 ) return "";
  let prefix = stems[0];
  for ( const stem of stems.slice(1) ) {
    let i = 0;
    while ( (i < prefix.length) && (i < stem.length) && (prefix[i].toLowerCase() === stem[i].toLowerCase()) ) i++;
    prefix = prefix.slice(0, i);
  }
  const cut = Math.max(...["-", "_", " ", "."].map(c => prefix.lastIndexOf(c)));
  return cut >= 0 ? prefix.slice(0, cut + 1) : "";
}

/* -------------------------------------------- */

/**
 * A readable label from a file name: "mira-vista-look-left" with prefix "mira-vista-" → "Look left".
 * @param {string} stem
 * @param {string} [prefix]
 * @returns {string}
 */
export function labelFromStem(stem, prefix="") {
  stem = String(stem ?? "");
  let text = (prefix && stem.toLowerCase().startsWith(prefix.toLowerCase())) ? stem.slice(prefix.length) : stem;
  text = text.replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim();
  if ( !text ) text = stem.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/* -------------------------------------------- */

/**
 * A positive finite number or null.
 * @param {*} value
 * @returns {number|null}
 */
function positiveOrNull(value) {
  if ( (value === null) || (value === undefined) || (value === "") ) return null;
  const number = Number(value);
  return (Number.isFinite(number) && (number > 0)) ? number : null;
}

/* -------------------------------------------- */

/**
 * Bring one stored or submitted pose into a known shape.
 * @param {object} data
 * @param {() => string} makeId     Creates an id for poses which have none
 * @returns {VistaPose}
 */
export function normalizePose(data, makeId) {
  data ??= {};
  const src = (typeof data.src === "string") ? data.src.trim() : "";
  const height = positiveOrNull(data.height);
  return {
    id: ((typeof data.id === "string") && data.id) ? data.id : makeId(),
    label: String(data.label ?? "").trim() || (src ? labelFromStem(fileStem(src)) : ""),
    src,
    height: (height === null) ? null : Math.max(SIZE_MIN, height),
    mirror: !!data.mirror,
    aspect: positiveOrNull(data.aspect)
  };
}

/* -------------------------------------------- */

/**
 * Normalize a stored gallery. Entries without image and name are dropped, duplicate ids are replaced.
 * @param {object[]|object} list    The stored array (or an index-keyed object from a form)
 * @param {() => string} makeId
 * @returns {VistaPose[]}
 */
export function normalizePoses(list, makeId) {
  const entries = Array.isArray(list) ? list : Object.values(list ?? {});
  const seen = new Set();
  const poses = [];
  for ( const entry of entries ) {
    const pose = normalizePose(entry, makeId);
    if ( !pose.src && !pose.label ) continue;
    if ( seen.has(pose.id) ) pose.id = makeId();
    seen.add(pose.id);
    poses.push(pose);
  }
  return poses;
}

/* -------------------------------------------- */

/**
 * The poses which can be shown: those with an image.
 * @param {VistaPose[]} poses
 * @returns {VistaPose[]}
 */
export function usablePoses(poses) {
  return poses.filter(p => p.src);
}

/* -------------------------------------------- */

/**
 * Find a pose by id, by name (ignoring case) or by its 1-based position among the usable poses.
 * @param {VistaPose[]} poses
 * @param {string|number|null} ref
 * @returns {VistaPose|null}
 */
export function findPose(poses, ref) {
  if ( (ref === null) || (ref === undefined) || (ref === "") ) return null;
  const usable = usablePoses(poses);
  const byId = usable.find(p => p.id === ref);
  if ( byId ) return byId;
  const name = String(ref).trim().toLowerCase();
  const byLabel = usable.find(p => p.label.toLowerCase() === name);
  if ( byLabel ) return byLabel;
  const index = Number(ref);
  if ( Number.isInteger(index) && (index >= 1) ) return usable[index - 1] ?? null;
  return null;
}

/* -------------------------------------------- */

/**
 * The id of the next or previous usable pose, wrapping around. Without a current pose, forward starts at the first
 * pose and backward at the last.
 * @param {VistaPose[]} poses
 * @param {string|null} currentId
 * @param {number} step             +1 or -1
 * @returns {string|null}
 */
export function cyclePose(poses, currentId, step) {
  const usable = usablePoses(poses);
  if ( !usable.length ) return null;
  const index = usable.findIndex(p => p.id === currentId);
  if ( index < 0 ) return (step >= 0 ? usable[0] : usable.at(-1)).id;
  const n = usable.length;
  return usable[(((index + step) % n) + n) % n].id;
}

/* -------------------------------------------- */

/**
 * Turn image files into new poses, one per image. Images already in the gallery are skipped. Names come from the
 * file names without their common beginning.
 * @param {string[]} paths
 * @param {object} options
 * @param {VistaPose[]} [options.existing]     Poses already in the gallery; their files are skipped
 * @param {() => string} options.makeId
 * @param {string} [options.preferred]         An image to put first, e.g. the actor's portrait
 * @returns {VistaPose[]}
 */
export function posesFromFiles(paths, {existing=[], makeId, preferred}={}) {
  const known = new Set(existing.map(p => p.src).filter(Boolean).map(withoutQuery));
  const files = [...new Set(paths)].filter(p => p && !known.has(withoutQuery(p)));

  // Names without the beginning all files share
  const stems = files.map(fileStem).concat(existing.filter(p => p.src).map(p => fileStem(p.src)));
  const prefix = commonPrefix(stems);
  const added = files.map(src => normalizePose({label: labelFromStem(fileStem(src), prefix), src}, makeId));
  added.sort((a, b) => a.label.localeCompare(b.label));
  if ( preferred ) {
    preferred = withoutQuery(preferred);
    const first = added.findIndex(p => withoutQuery(p.src) === preferred);
    if ( first > 0 ) added.unshift(...added.splice(first, 1));
  }
  return added;
}

/* -------------------------------------------- */

/**
 * Does a file name continue another one, as variants of a portrait do? After the shared beginning comes a separator,
 * a number or a new word: "merchant" → "merchant-angry", "merchant_2", "MerchantCloak", but not "merchants".
 * @param {string} stem
 * @param {string} base
 * @returns {boolean}
 */
export function sharesStem(stem, base) {
  stem = String(stem ?? "");
  base = String(base ?? "");
  if ( !base || !stem.toLowerCase().startsWith(base.toLowerCase()) ) return false;
  if ( stem.length === base.length ) return true;
  const last = base.at(-1);
  const next = stem.charAt(base.length);
  if ( /\p{L}/u.test(last) && /\p{Ll}/u.test(next) ) return false; // The word goes on
  return !(/\d/.test(last) && /\d/.test(next));                    // The number goes on: "guard-1", "guard-12"
}

/* -------------------------------------------- */

/**
 * The images of a folder which look like variants of some portraits, sorted by name. The portraits themselves and
 * images already in the gallery are left out.
 * @param {string[]} files                     Image paths of the folder
 * @param {string[]} references                The portraits whose variants are wanted
 * @param {object} [options]
 * @param {VistaPose[]} [options.existing]     Poses already in the gallery
 * @returns {string[]}
 */
export function alternateFiles(files, references, {existing=[]}={}) {
  references = references.filter(Boolean).map(withoutQuery);
  const bases = references.map(fileStem).filter(Boolean);
  const known = new Set(existing.map(p => p.src).filter(Boolean).map(withoutQuery).concat(references));
  const found = new Map();
  for ( const file of files ) {
    const path = withoutQuery(file);
    if ( !path || known.has(path) || found.has(path) ) continue;
    if ( bases.some(base => sharesStem(fileStem(file), base)) ) found.set(path, file);
  }
  return [...found.values()].sort((a, b) => fileStem(a).localeCompare(fileStem(b)));
}

/* -------------------------------------------- */
/*  Portrait math                               */
/* -------------------------------------------- */

/**
 * Round a size to Ember's half-foot steps (as Ember's data model does when it reads the portrait flag).
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
export function toSizeStep(value, fallback) {
  const number = Number(value);
  if ( !Number.isFinite(number) || (number <= 0) ) return fallback;
  return Math.max(SIZE_MIN, SIZE_MIN + (Math.round((number - SIZE_MIN) / SIZE_STEP) * SIZE_STEP));
}

/* -------------------------------------------- */

/**
 * A number between 0 and 1, or the fallback.
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
function alpha(value, fallback) {
  const number = Number(value);
  if ( (value === null) || (value === undefined) || !Number.isFinite(number) ) return fallback;
  return Math.min(1, Math.max(0, number));
}

/* -------------------------------------------- */

/**
 * Portrait data as Ember reads it from `flags.ember.portrait`: defaults filled in, sizes in half-foot steps.
 * @param {object} [data]
 * @returns {{height: number, width: number, anchorX: number, anchorY: number, flip: boolean}}
 */
export function cleanPortrait(data) {
  data ??= {};
  return {
    ...data,
    height: toSizeStep(data.height, DEFAULT_PORTRAIT.height),
    width: toSizeStep(data.width, DEFAULT_PORTRAIT.width),
    anchorX: alpha(data.anchorX, DEFAULT_PORTRAIT.anchorX),
    anchorY: alpha(data.anchorY, DEFAULT_PORTRAIT.anchorY),
    flip: !!data.flip
  };
}

/* -------------------------------------------- */

/**
 * The portrait data of a pose: its own figure height (or the actor's), a width that follows the proportions of the
 * image, and the pose's mirroring on top of the actor's. Without a pose this is the actor's own portrait.
 * @param {object} base               The actor's portrait data
 * @param {VistaPose|null} pose
 * @param {number|null} [aspect]      Width / height of the shown image
 * @returns {ReturnType<typeof cleanPortrait>}
 */
export function posePortrait(base, pose, aspect) {
  base = cleanPortrait(base);
  if ( !pose ) return base;
  const height = toSizeStep(pose.height ?? base.height, base.height);
  const width = (Number.isFinite(aspect) && (aspect > 0))
    ? toSizeStep(height * aspect, base.width)
    : toSizeStep(base.width * (height / base.height), base.width);
  return cleanPortrait({...base, height, width, flip: base.flip !== !!pose.mirror});
}

/* -------------------------------------------- */

/**
 * The token size for new portrait data. In a Vista the size of a token at a given depth is proportional to its
 * portrait size, so the current size is scaled by the change of the portrait.
 * @param {{width: number, height: number}} size     The current token size (grid units)
 * @param {{width: number, height: number}} from     The portrait data the size was computed from
 * @param {{width: number, height: number}} to       The new portrait data
 * @returns {{width: number, height: number}}
 */
export function scaledSize(size, from, to) {
  const round = value => Math.round(value * 10000) / 10000;
  return {
    width: round(size.width * (to.width / from.width)),
    height: round(size.height * (to.height / from.height))
  };
}

/* -------------------------------------------- */

/**
 * The horizontal texture scale after a change of the portrait's mirroring. The direction the token faces
 * (its rotation) is kept.
 * @param {number} scaleX
 * @param {boolean} fromFlip
 * @param {boolean} toFlip
 * @returns {number}
 */
export function flippedScaleX(scaleX, fromFlip, toFlip) {
  return (!!fromFlip !== !!toFlip) ? -scaleX : scaleX;
}
