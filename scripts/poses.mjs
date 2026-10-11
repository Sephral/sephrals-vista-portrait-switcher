/**
 * Pure helpers for portrait galleries: normalizing stored poses, turning image files into poses and the portrait
 * math of Ember Vistas. Nothing here touches Foundry globals, so the helpers also run in Node tests.
 */

/**
 * @typedef VistaPose
 * @property {string} id                 Stable id of the pose
 * @property {string} label              Name shown in the palette and the gallery
 * @property {string} src                Image path
 * @property {string|null} lightSrc      Optional variant of the image with light (e.g. a light orb)
 * @property {number|null} height        Figure height in feet, null = the actor's portrait height
 * @property {boolean} mirror            Mirror this image relative to the actor's portrait
 * @property {number|null} aspect        Width / height of `src`, cached for synchronous use
 * @property {number|null} lightAspect   Width / height of `lightSrc`
 */

/**
 * Ember's defaults for the portrait of an actor in a Vista (feet).
 * @type {Readonly<{height: number, width: number, anchorX: number, anchorY: number, flip: boolean}>}
 */
export const DEFAULT_PORTRAIT = Object.freeze({height: 6, width: 3, anchorX: 0.5, anchorY: 1, flip: false});

/** Ember stores portrait sizes in steps of half a foot, starting at one foot. */
const SIZE_STEP = 0.5;
const SIZE_MIN = 1;

/** A file name ending which marks the variant of an image with light: "-licht", "_light", " lit" … */
const LIGHT_SUFFIX = /^(.*?)[-_ .]+(licht|light|lit)$/i;

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
 * Split the light marker off a file name: "tharun-front-licht" → {base: "tharun-front", light: true}.
 * @param {string} stem
 * @returns {{base: string, light: boolean}}
 */
export function splitLightSuffix(stem) {
  const match = String(stem).match(LIGHT_SUFFIX);
  return match ? {base: match[1], light: true} : {base: String(stem), light: false};
}

/* -------------------------------------------- */

/**
 * The longest common beginning of several names, cut back to the last separator ("tharun-vista-").
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
 * A readable label from a file name: "tharun-vista-blick-links" with prefix "tharun-vista-" → "Blick links".
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
  const lightSrc = (typeof data.lightSrc === "string") ? data.lightSrc.trim() : "";
  const height = positiveOrNull(data.height);
  return {
    id: ((typeof data.id === "string") && data.id) ? data.id : makeId(),
    label: String(data.label ?? "").trim() || (src ? labelFromStem(fileStem(src)) : ""),
    src,
    lightSrc: lightSrc || null,
    height: (height === null) ? null : Math.max(SIZE_MIN, height),
    mirror: !!data.mirror,
    aspect: positiveOrNull(data.aspect),
    lightAspect: lightSrc ? positiveOrNull(data.lightAspect) : null
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
 * Turn image files into new poses. A file ending in "-licht", "-light" or "-lit" becomes the light variant of the
 * file with the same name, also of a pose that is already in the gallery. Names come from the file names without
 * their common beginning.
 * @param {string[]} paths
 * @param {object} options
 * @param {VistaPose[]} [options.existing]     Poses already in the gallery; their files are skipped
 * @param {() => string} options.makeId
 * @param {string} [options.preferred]         An image to put first, e.g. the actor's portrait
 * @returns {{added: VistaPose[], attached: {id: string, lightSrc: string}[]}}
 */
export function posesFromFiles(paths, {existing=[], makeId, preferred}={}) {
  const known = new Set(existing.flatMap(p => [p.src, p.lightSrc]).filter(Boolean).map(withoutQuery));
  const files = [...new Set(paths)].filter(p => p && !known.has(withoutQuery(p)));

  // Pair plain images with their light variants
  const groups = new Map();
  for ( const path of files ) {
    const {base, light} = splitLightSuffix(fileStem(path));
    const key = base.toLowerCase();
    const group = groups.get(key) ?? {base, src: null, lightSrc: null};
    if ( light ) group.lightSrc ??= path;
    else group.src ??= path;
    groups.set(key, group);
  }

  // Light variants of poses which are already in the gallery
  const attached = [];
  const existingByBase = new Map();
  for ( const pose of existing ) {
    if ( pose.src ) existingByBase.set(splitLightSuffix(fileStem(pose.src)).base.toLowerCase(), pose);
  }
  for ( const [key, group] of groups ) {
    const pose = existingByBase.get(key);
    if ( group.src || !pose || pose.lightSrc ) continue;
    attached.push({id: pose.id, lightSrc: group.lightSrc});
    groups.delete(key);
  }

  // Names without the beginning all files share
  const stems = [...groups.values()].map(g => g.base)
    .concat(existing.filter(p => p.src).map(p => splitLightSuffix(fileStem(p.src)).base));
  const prefix = commonPrefix(stems);
  const added = [...groups.values()].map(group => normalizePose({
    label: labelFromStem(group.base, prefix),
    src: group.src ?? group.lightSrc,
    lightSrc: group.src ? group.lightSrc : null
  }, makeId));
  added.sort((a, b) => a.label.localeCompare(b.label));
  if ( preferred ) {
    preferred = withoutQuery(preferred);
    const first = added.findIndex(p => (withoutQuery(p.src) === preferred) || (withoutQuery(p.lightSrc) === preferred));
    if ( first > 0 ) added.unshift(...added.splice(first, 1));
  }
  return {added, attached};
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
 * The image a pose shows: the light variant if light is on and the pose has one. Without a pose the fallback.
 * @param {VistaPose|null} pose
 * @param {boolean} light
 * @param {string} [fallback]
 * @returns {string|null}
 */
export function poseSource(pose, light, fallback=null) {
  if ( !pose ) return fallback;
  return (light && pose.lightSrc) ? pose.lightSrc : pose.src;
}

/* -------------------------------------------- */

/**
 * The cached proportions of the image a pose shows.
 * @param {VistaPose|null} pose
 * @param {boolean} light
 * @returns {number|null}
 */
export function poseAspect(pose, light) {
  if ( !pose ) return null;
  return (light && pose.lightSrc) ? pose.lightAspect : pose.aspect;
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
