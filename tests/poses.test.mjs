import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanPortrait, commonPrefix, cyclePose, fileStem, findPose, flippedScaleX, labelFromStem, normalizePoses,
  poseAspect, posePortrait, poseSource, posesFromFiles, scaledSize, splitLightSuffix, toSizeStep, usablePoses,
  withoutQuery
} from "../scripts/poses.mjs";

let counter = 0;
const makeId = () => `id${++counter}`;

const DIR = "worlds/ember-crucible/assets/actors/tharun";
const THARUN_FILES = [
  "blick-links-licht", "blick-links", "blick-rechts-licht", "blick-rechts", "erdwesen-licht", "erdwesen",
  "front-licht", "front", "kampf-licht", "kampf", "lesend", "lichtkugel", "mit-kiesel-licht", "mit-kiesel",
  "ruecken-licht", "ruecken"
].map(name => `${DIR}/tharun-vista-${name}.webp`);

test("fileStem strips folders, query and extension and decodes the name", () => {
  assert.equal(fileStem("worlds/w/a/tharun-vista-front.webp"), "tharun-vista-front");
  assert.equal(fileStem("C:\\images\\Figur%20lesend.png?v=3"), "Figur lesend");
  assert.equal(fileStem("noext"), "noext");
  assert.equal(fileStem(null), "");
});

test("withoutQuery drops the query of a path", () => {
  assert.equal(withoutQuery("a/b.webp?123"), "a/b.webp");
  assert.equal(withoutQuery(null), "");
});

test("splitLightSuffix recognizes German and English light markers", () => {
  assert.deepEqual(splitLightSuffix("front-licht"), {base: "front", light: true});
  assert.deepEqual(splitLightSuffix("Front_Light"), {base: "Front", light: true});
  assert.deepEqual(splitLightSuffix("front lit"), {base: "front", light: true});
  assert.deepEqual(splitLightSuffix("lichtkugel"), {base: "lichtkugel", light: false});
  assert.deepEqual(splitLightSuffix("highlight"), {base: "highlight", light: false});
});

test("commonPrefix cuts back to a separator", () => {
  assert.equal(commonPrefix(["tharun-vista-front", "tharun-vista-kampf"]), "tharun-vista-");
  assert.equal(commonPrefix(["tharun-vista-lesend", "tharun-vista-lichtkugel"]), "tharun-vista-");
  assert.equal(commonPrefix(["abc", "abd"]), "");
  assert.equal(commonPrefix(["only-one"]), "");
});

test("labelFromStem builds readable names", () => {
  assert.equal(labelFromStem("tharun-vista-blick-links", "tharun-vista-"), "Blick links");
  assert.equal(labelFromStem("mit_kiesel"), "Mit kiesel");
  assert.equal(labelFromStem("tharun-vista-", "tharun-vista-"), "Tharun-vista-");
});

test("normalizePoses fills defaults, drops empty entries and repairs ids", () => {
  const poses = normalizePoses([
    {id: "a", label: " Kampf ", src: " x/kampf.webp ", height: "3.5", mirror: 1, aspect: 0.75},
    {id: "a", src: "x/lesend.webp", height: 0},
    {label: "", src: ""},
    {label: "Neu", src: ""}
  ], makeId);
  assert.equal(poses.length, 3);
  assert.deepEqual(poses[0], {id: "a", label: "Kampf", src: "x/kampf.webp", lightSrc: null, height: 3.5, mirror: true,
    aspect: 0.75, lightAspect: null});
  assert.notEqual(poses[1].id, "a");
  assert.equal(poses[1].label, "Lesend");
  assert.equal(poses[1].height, null);
  assert.equal(poses[2].label, "Neu");
  assert.deepEqual(usablePoses(poses).map(p => p.label), ["Kampf", "Lesend"]);
});

test("normalizePoses accepts the index-keyed object of a form", () => {
  const poses = normalizePoses({0: {id: "p", src: "a.webp"}, 1: {id: "q", src: "b.webp"}}, makeId);
  assert.deepEqual(poses.map(p => p.id), ["p", "q"]);
});

test("findPose finds by id, name and number", () => {
  const poses = normalizePoses([{id: "x", label: "Leer"}, {id: "a", label: "Front", src: "f.webp"},
    {id: "b", label: "Kampf", src: "k.webp"}], makeId);
  assert.equal(findPose(poses, "b").label, "Kampf");
  assert.equal(findPose(poses, "kampf").id, "b");
  assert.equal(findPose(poses, 1).id, "a");
  assert.equal(findPose(poses, "2").id, "b");
  assert.equal(findPose(poses, "x"), null, "a pose without image cannot be shown");
  assert.equal(findPose(poses, 3), null);
  assert.equal(findPose(poses, null), null);
});

test("cyclePose wraps around and starts at the ends", () => {
  const poses = normalizePoses([{id: "a", src: "a"}, {id: "b", src: "b"}, {id: "c", src: "c"}], makeId);
  assert.equal(cyclePose(poses, "a", 1), "b");
  assert.equal(cyclePose(poses, "c", 1), "a");
  assert.equal(cyclePose(poses, "a", -1), "c");
  assert.equal(cyclePose(poses, null, 1), "a");
  assert.equal(cyclePose(poses, null, -1), "c");
  assert.equal(cyclePose([], null, 1), null);
});

test("posesFromFiles pairs Tharun's light variants and names the poses", () => {
  const {added, attached} = posesFromFiles(THARUN_FILES, {makeId, preferred: `${DIR}/tharun-vista-front.webp`});
  assert.equal(attached.length, 0);
  assert.equal(added.length, 9);
  assert.equal(added[0].label, "Front", "the actor image comes first");
  assert.equal(added[0].lightSrc, `${DIR}/tharun-vista-front-licht.webp`);
  const labels = added.map(p => p.label);
  assert.deepEqual(labels.slice(1), ["Blick links", "Blick rechts", "Erdwesen", "Kampf", "Lesend", "Lichtkugel",
    "Mit kiesel", "Ruecken"]);
  const lesend = added.find(p => p.label === "Lesend");
  assert.equal(lesend.lightSrc, null);
  assert.equal(added.filter(p => p.lightSrc).length, 7);
});

test("posesFromFiles skips known files and attaches light variants to existing poses", () => {
  const existing = normalizePoses([{id: "front", label: "Front", src: `${DIR}/tharun-vista-front.webp`}], makeId);
  const {added, attached} = posesFromFiles([
    `${DIR}/tharun-vista-front.webp`, `${DIR}/tharun-vista-front-licht.webp`, `${DIR}/tharun-vista-kampf.webp`
  ], {existing, makeId});
  assert.deepEqual(attached, [{id: "front", lightSrc: `${DIR}/tharun-vista-front-licht.webp`}]);
  assert.equal(added.length, 1);
  assert.equal(added[0].label, "Kampf", "the prefix is learned from the existing poses");
});

test("posesFromFiles ignores the cache-busting query of the actor image", () => {
  const {added} = posesFromFiles(THARUN_FILES, {makeId, preferred: `${DIR}/tharun-vista-front.webp?1791653960670`});
  assert.equal(added[0].label, "Front");
  const existing = normalizePoses([{id: "f", src: `${DIR}/tharun-vista-kampf.webp?123`}], makeId);
  const again = posesFromFiles([`${DIR}/tharun-vista-kampf.webp`], {existing, makeId});
  assert.equal(again.added.length, 0);
});

test("posesFromFiles keeps a lone light image as a pose of its own", () => {
  const {added} = posesFromFiles(["a/nacht-licht.webp"], {makeId});
  assert.equal(added.length, 1);
  assert.equal(added[0].src, "a/nacht-licht.webp");
  assert.equal(added[0].lightSrc, null);
});

test("toSizeStep and cleanPortrait follow Ember's data model", () => {
  assert.equal(toSizeStep(2.91, 3), 3);
  assert.equal(toSizeStep(2.74, 3), 2.5);
  assert.equal(toSizeStep(4.5, 6), 4.5);
  assert.equal(toSizeStep(0.2, 6), 1);
  assert.equal(toSizeStep("x", 6), 6);
  assert.deepEqual(cleanPortrait(undefined), {height: 6, width: 3, anchorX: 0.5, anchorY: 1, flip: false});
  assert.deepEqual(cleanPortrait({height: 4.5, width: 2.91, artist: "A"}),
    {height: 4.5, width: 3, anchorX: 0.5, anchorY: 1, flip: false, artist: "A"});
});

test("posePortrait uses the pose height and the image proportions", () => {
  const base = {height: 4.5, width: 2.91, anchorX: 0.5, anchorY: 1};
  assert.deepEqual(posePortrait(base, null), cleanPortrait(base));
  const kampf = {height: null, mirror: false};
  assert.deepEqual(posePortrait(base, kampf, 1032 / 1363), {...cleanPortrait(base), height: 4.5, width: 3.5});
  const kneeling = {height: 3, mirror: true};
  const portrait = posePortrait(base, kneeling, 0.69);
  assert.equal(portrait.height, 3);
  assert.equal(portrait.width, 2);
  assert.equal(portrait.flip, true);
  const noAspect = posePortrait({height: 6, width: 3}, {height: 3});
  assert.equal(noAspect.width, 1.5);
  assert.equal(posePortrait({height: 6, width: 3, flip: true}, {mirror: true}).flip, false);
});

test("poseSource and poseAspect choose the light variant only when it exists", () => {
  const pose = {src: "a.webp", lightSrc: "a-licht.webp", aspect: 0.6, lightAspect: 0.7};
  assert.equal(poseSource(pose, false), "a.webp");
  assert.equal(poseSource(pose, true), "a-licht.webp");
  assert.equal(poseSource({src: "b.webp", lightSrc: null}, true), "b.webp");
  assert.equal(poseSource(null, true, "actor.webp"), "actor.webp");
  assert.equal(poseAspect(pose, true), 0.7);
  assert.equal(poseAspect({aspect: 0.5, lightSrc: null}, true), 0.5);
  assert.equal(poseAspect(null, false), null);
});

test("scaledSize scales the token with the portrait", () => {
  const size = scaledSize({width: 1.2, height: 1.8}, {width: 3, height: 4.5}, {width: 3.5, height: 3});
  assert.equal(size.width, 1.4);
  assert.equal(size.height, 1.2);
});

test("flippedScaleX keeps the facing unless the mirroring changes", () => {
  assert.equal(flippedScaleX(-1, false, false), -1);
  assert.equal(flippedScaleX(-1, false, true), 1);
  assert.equal(flippedScaleX(1, true, false), -1);
});
