import assert from "node:assert/strict";
import test from "node:test";

import {
  alternateFiles, cleanPortrait, commonPrefix, cyclePose, fileStem, findPose, flippedScaleX, labelFromStem,
  normalizePoses, posePortrait, posesFromFiles, scaledSize, sharesStem, toSizeStep, usablePoses, withoutQuery
} from "../scripts/poses.mjs";

let counter = 0;
const makeId = () => `id${++counter}`;

const DIR = "worlds/my-world/assets/actors/hero";
const HERO_FILES = [
  "front", "front-night", "back", "kneeling", "reading", "fighting", "look-left", "look-right"
].map(name => `${DIR}/hero-vista-${name}.webp`);

test("fileStem strips folders, query and extension and decodes the name", () => {
  assert.equal(fileStem("worlds/w/a/hero-vista-front.webp"), "hero-vista-front");
  assert.equal(fileStem("C:\\images\\Figure%20reading.png?v=3"), "Figure reading");
  assert.equal(fileStem("noext"), "noext");
  assert.equal(fileStem(null), "");
});

test("withoutQuery drops the query of a path", () => {
  assert.equal(withoutQuery("a/b.webp?123"), "a/b.webp");
  assert.equal(withoutQuery(null), "");
});

test("commonPrefix cuts back to a separator", () => {
  assert.equal(commonPrefix(["hero-vista-front", "hero-vista-fighting"]), "hero-vista-");
  assert.equal(commonPrefix(["hero-vista-look-left", "hero-vista-look-right"]), "hero-vista-look-");
  assert.equal(commonPrefix(["abc", "abd"]), "");
  assert.equal(commonPrefix(["only-one"]), "");
});

test("labelFromStem builds readable names", () => {
  assert.equal(labelFromStem("hero-vista-look-left", "hero-vista-"), "Look left");
  assert.equal(labelFromStem("with_pebble"), "With pebble");
  assert.equal(labelFromStem("hero-vista-", "hero-vista-"), "Hero-vista-");
});

test("normalizePoses fills defaults, drops empty entries and repairs ids", () => {
  const poses = normalizePoses([
    {id: "a", label: " Fighting ", src: " x/fighting.webp ", height: "3.5", mirror: 1, aspect: 0.75},
    {id: "a", src: "x/reading.webp", height: 0},
    {label: "", src: ""},
    {label: "New", src: ""}
  ], makeId);
  assert.equal(poses.length, 3);
  assert.deepEqual(poses[0], {id: "a", label: "Fighting", src: "x/fighting.webp", height: 3.5, mirror: true,
    aspect: 0.75});
  assert.notEqual(poses[1].id, "a");
  assert.equal(poses[1].label, "Reading");
  assert.equal(poses[1].height, null);
  assert.equal(poses[2].label, "New");
  assert.deepEqual(usablePoses(poses).map(p => p.label), ["Fighting", "Reading"]);
});

test("normalizePoses drops fields of earlier versions", () => {
  const [pose] = normalizePoses([{id: "p", src: "a.webp", lightSrc: "a-light.webp", lightAspect: 0.5}], makeId);
  assert.deepEqual(Object.keys(pose).sort(), ["aspect", "height", "id", "label", "mirror", "src"]);
});

test("normalizePoses accepts the index-keyed object of a form", () => {
  const poses = normalizePoses({0: {id: "p", src: "a.webp"}, 1: {id: "q", src: "b.webp"}}, makeId);
  assert.deepEqual(poses.map(p => p.id), ["p", "q"]);
});

test("findPose finds by id, name and number", () => {
  const poses = normalizePoses([{id: "x", label: "Empty"}, {id: "a", label: "Front", src: "f.webp"},
    {id: "b", label: "Fighting", src: "k.webp"}], makeId);
  assert.equal(findPose(poses, "b").label, "Fighting");
  assert.equal(findPose(poses, "fighting").id, "b");
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

test("posesFromFiles makes one portrait per image and names it after the file", () => {
  const added = posesFromFiles(HERO_FILES, {makeId, preferred: `${DIR}/hero-vista-front.webp`});
  assert.equal(added.length, 8, "every image becomes a portrait, also variants such as \"front-night\"");
  assert.equal(added[0].label, "Front", "the actor image comes first");
  assert.deepEqual(added.slice(1).map(p => p.label),
    ["Back", "Fighting", "Front night", "Kneeling", "Look left", "Look right", "Reading"]);
  assert.ok(added.every(p => p.src.startsWith(DIR) && (p.height === null) && !p.mirror));
});

test("posesFromFiles skips images already in the gallery and learns the prefix from them", () => {
  const existing = normalizePoses([{id: "front", label: "Front", src: `${DIR}/hero-vista-front.webp`}], makeId);
  const added = posesFromFiles([`${DIR}/hero-vista-front.webp`, `${DIR}/hero-vista-fighting.webp`], {existing, makeId});
  assert.equal(added.length, 1);
  assert.equal(added[0].label, "Fighting");
});

test("posesFromFiles ignores the cache-busting query of the actor image", () => {
  const added = posesFromFiles(HERO_FILES, {makeId, preferred: `${DIR}/hero-vista-front.webp?1791653960670`});
  assert.equal(added[0].label, "Front");
  const existing = normalizePoses([{id: "f", src: `${DIR}/hero-vista-fighting.webp?123`}], makeId);
  assert.equal(posesFromFiles([`${DIR}/hero-vista-fighting.webp`], {existing, makeId}).length, 0);
});

test("posesFromFiles keeps a single file's full name", () => {
  const added = posesFromFiles(["a/night_watch.webp"], {makeId});
  assert.equal(added.length, 1);
  assert.equal(added[0].label, "Night watch");
});

test("sharesStem accepts separators, numbers and new words after the name", () => {
  assert.ok(sharesStem("merchant-angry", "merchant"));
  assert.ok(sharesStem("merchant_2", "merchant"));
  assert.ok(sharesStem("Merchant Laughing", "merchant"));
  assert.ok(sharesStem("MerchantCloak", "Merchant"));
  assert.ok(sharesStem("merchant", "merchant"), "the same name with another extension");
  assert.ok(sharesStem("guard-1b", "guard-1"));
  assert.ok(!sharesStem("merchants", "merchant"), "a longer word is another name");
  assert.ok(!sharesStem("guard-12", "guard-1"), "a longer number is another figure");
  assert.ok(!sharesStem("innkeeper", "merchant"));
  assert.ok(!sharesStem("merchant", ""));
});

test("alternateFiles offers variants next to the portrait and skips the gallery", () => {
  const dir = "worlds/w/npcs";
  const files = ["merchant.webp", "merchant-angry.webp", "merchant_2.png", "MerchantCloak.webp", "merchants.webp",
    "innkeeper.webp", "merchant-sad.webp?12", "notes.txt"].map(f => `${dir}/${f}`);
  const existing = normalizePoses([{src: `${dir}/merchant-sad.webp`}], makeId);
  const found = alternateFiles(files, [`${dir}/merchant.webp?1791653960670`], {existing});
  assert.deepEqual(found, [`${dir}/merchant_2.png`, `${dir}/merchant-angry.webp`, `${dir}/MerchantCloak.webp`],
    "neither the portrait itself nor a gallery image is offered, the result is sorted by name");
  assert.deepEqual(alternateFiles(files, [`${dir}/Merchant.webp`, `${dir}/innkeeper.webp`]).length, 5,
    "the names compare without case, and several portraits are checked at once");
  assert.deepEqual(alternateFiles([...files, ...files], [`${dir}/MerchantCloak.webp`]), [],
    "duplicates and the reference itself are dropped");
  assert.deepEqual(alternateFiles(files, [null, ""]), []);
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
  const fighting = {height: null, mirror: false};
  assert.deepEqual(posePortrait(base, fighting, 1032 / 1363), {...cleanPortrait(base), height: 4.5, width: 3.5});
  const kneeling = {height: 3, mirror: true};
  const portrait = posePortrait(base, kneeling, 0.69);
  assert.equal(portrait.height, 3);
  assert.equal(portrait.width, 2);
  assert.equal(portrait.flip, true);
  const noAspect = posePortrait({height: 6, width: 3}, {height: 3});
  assert.equal(noAspect.width, 1.5);
  assert.equal(posePortrait({height: 6, width: 3, flip: true}, {mirror: true}).flip, false);
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
