# Sephral’s Vista Portrait Switcher

Sephral’s Vista Portrait Switcher lets players and the GM change the portrait a character shows in Ember's Vista scenes on the fly. Show a mood, a pose or what the character is doing right now.

In a Vista, Ember shows a hero as a standing full body figure taken from the actor image. This module gives every character a gallery with as many portraits as you like. Pick one in the token HUD, in the gallery or with a hotkey, and the figure changes with Foundry's soft texture transition.

## Discord

[![Join Discord](https://img.shields.io/badge/Discord-Join%20the%20community-5865F2?logo=discord&logoColor=white)](https://discord.gg/7BjCgDYaBP)

Questions, feedback, and module support are welcome on [Discord](https://discord.gg/7BjCgDYaBP).

## Demo

![SVPS demo](media/demo.gif)

The demo shows a Vista with a plain backdrop instead of Ember's artwork. If the embedded preview is not available in your GitHub view, please check the media folder.

## Overview

* A gallery per character with any number of portraits: add single images or import a whole folder
* Pick a portrait in the token HUD palette, in the gallery or with a hotkey (Alt+1 … Alt+9, next and previous)
* Optional per portrait: its own figure height (for kneeling or crouching figures) and mirroring
* The figure keeps its place and the direction it faces, and the token is resized to the new image
* New Vista tokens of a character start with the portrait chosen last
* Works for every player and every character. Unlinked NPC tokens switch one by one
* Permissions for players, choice of transition, optional chat notice
* Self test for the GM after Ember or Foundry updates
* Foundry VTT v14 with Ember (Crucible or D&D 5e)
* English and German. The module language can follow Foundry or be set per user

## Installation

Requirements: Foundry VTT 14 and the Ember module.

1. Install the module with its manifest URL `https://github.com/Sephral/sephrals-vista-portrait-switcher/releases/latest/download/module.json`, or unpack the release zip into `Data/modules/sephrals-vista-portrait-switcher/` (the folder name must match, `module.json` lies directly inside).
2. Enable the module in the world (*Manage Modules*, GM).
3. Put the portrait images where everyone can load them, for example one folder per character under `assets/` of the world or the user data. Players without upload permission need the GM for this step.

Good portraits look like Ember's own Vista portraits: a transparent full body figure with the feet at the lower edge. Images must come from the Foundry server or from a source that allows cross origin requests. Images from web servers without CORS headers cannot be shown on the canvas.

## The gallery

Open it with

* *Vista portraits* in the header menu of the actor sheet,
* a right click on the actor in the actor directory → *Vista portraits*, or
* the gallery button in the token HUD palette.

| Action | How |
| --- | --- |
| Add one image | *Add image* opens Foundry's file picker. Users who may not browse files get an empty portrait and type the image path |
| Import a folder | *Import folder* adds every image of a folder as a portrait. Names come from the file names without their common beginning (`mira-vista-look-left.webp` → "Look left"), and the actor image comes first. A second import skips images that are already in the gallery |
| Name | Text field of the portrait |
| Height | Height of the figure in feet. Empty: the character's portrait height (Ember's `flags.ember.portrait.height`). Use a lower value for kneeling or crouching figures |
| Mirror | The figure in this image faces the other way than in the character's own portrait |
| Order | Arrows. The first nine portraits get the hotkeys 1 to 9 |
| Remove | Bin. The image file stays |
| Show | Click the image |

Changes are saved immediately and appear for everyone. *Own portrait* shows the actor image again.

## Switching

* **Token HUD:** right click the character in a Vista, click the mask button and pick a portrait. The palette also offers the character's own portrait and the gallery. The HUD reopens after the transition, so the next portrait is one click away.
* **Gallery:** click a portrait.
* **Hotkeys** (*Configure Controls*, changeable). They act on the selected tokens in the viewed Vista. With nothing selected they act on your assigned character.

| Hotkey | Action |
| --- | --- |
| Alt+1 … Alt+9 | Portrait 1 … 9 |
| Alt+0 | The character's own portrait (the actor image) |
| Alt+Page Down / Alt+Page Up | Next / previous portrait |
| (none) | Open the gallery |

What changes:

* **Characters (linked tokens):** all their Vista tokens, or only those in the current Vista (setting *A switch changes*). The character remembers the portrait, and a new token placed in a Vista starts with it.
* **Unlinked tokens (NPCs):** only the token that was switched. From the gallery of such an actor the switch reaches the selected tokens.
* The figure keeps its place (Ember draws Vista tokens from their feet) and the direction it faces. Its size follows the portrait: the height of the portrait and a width that matches the proportions of the image.

## Settings

All options are in Foundry's settings dialog: *Game Settings → Configure Settings → Sephral’s Vista Portrait Switcher*. World options are only shown to the GM and apply to everyone. Players see their own options.

| Option | Scope | Default | Meaning |
| --- | --- | --- | --- |
| Language | Client | Follow Foundry | Follow Foundry's language or use German or English for this module |
| Players switch portraits | World | On | Players may switch the portraits of the characters they own |
| Players edit galleries | World | On | Players may add, rename and remove the portraits of the characters they own |
| A switch changes | World | All Vista tokens | All Vista tokens of the character, or only those in the current Vista |
| New tokens keep the portrait | World | On | New Vista tokens of a character start with the portrait chosen last |
| Announce in chat | World | Off | A short chat message with the new portrait whenever a character switches |
| Transition | World | Fade | Foundry's token transitions (fade, swirl, morph, hologram …) or none |
| Transition duration (ms) | World | 600 | Duration of the transition |
| Button in the token HUD | User | On | Show the mask button in the HUD of Vista tokens |
| Self test | GM | | Button *Run self test*, see below |

The GM can always switch and edit everything.

## Self test after updates

The module relies on a few Ember internals. After an update of Ember or Foundry it tells the GM once that newer versions are running. Then click *Run self test* in the module settings, or run `game.modules.get("sephrals-vista-portrait-switcher").api.runSelfTest()`. It checks Ember's Vista scene manager, the Vista scenes of the world, Ember's portrait data on Vista tokens and Foundry's transitions. It also loads every image of every gallery and whispers a report to the GM. The test changes no data.

## Stored data

| Where | Key | Content |
| --- | --- | --- |
| Actor | `flags.sephrals-vista-portrait-switcher.poses` | The gallery: `{id, label, src, height, mirror, aspect}` |
| Actor | `flags.sephrals-vista-portrait-switcher.pose` | The character's current portrait |
| Token | `flags.sephrals-vista-portrait-switcher.pose` | The portrait the token shows |
| Token | `texture.src`, `texture.scaleX`, `width`, `height`, `flags.ember.portrait` | Changed on every switch. *Own portrait* restores the values Ember uses |

`aspect` caches the proportions of an image, so a new token can be sized before the image is loaded.

## API

```js
const api = game.modules.get("sephrals-vista-portrait-switcher").api;
const mira = game.actors.getName("Mira");

await api.setPose(mira, "Reading");   // by name, id or number (1 = first portrait)
await api.setPose(mira, 2);           // the second portrait
await api.resetPose(mira);            // the actor image
await api.stepPose(mira, 1);          // next portrait, or previous with -1
api.openGallery(mira);
api.getPoses(mira);                   // the gallery
api.poseState(mira);                  // {pose}
api.openSettings();                   // Foundry's settings dialog on this module
await api.runSelfTest();              // GM
```

A target can be an actor, a token, a token document, an actor id, name or UUID. The functions respect the permissions of the current user.

## Limitations

* Only Ember's Vista scenes. On other scenes the module does nothing, and Ember's dynamic tokens stay as they are.
* Foundry redraws a token after a texture transition, which closes the token HUD. The module reopens it with the palette.
* The module relies on these Ember internals: Vistas are recognized through `CONFIG.Canvas.managedScenes` and Ember's `EmberVista` scene manager, sizes through `flags.ember.portrait`. Verified with Ember 0.6.3 and Foundry 14.369. Run the self test after updates.

## Development

| File | Content |
| --- | --- |
| `scripts/svps.mjs` | Entry point: hooks and API |
| `scripts/settings.mjs` | Settings, self test button and hotkeys |
| `scripts/language.mjs` | Module language (follow Foundry, German or English) |
| `scripts/vista.mjs` | Vista detection, permissions, switching, new tokens |
| `scripts/poses.mjs` | Pure helpers: galleries, file import, portrait math (unit tested) |
| `scripts/hud.mjs` | Token HUD button and palette |
| `scripts/gallery.mjs` | Gallery window |
| `scripts/controls.mjs` | Hotkey handlers, sheet header and actor directory entries |
| `scripts/selftest.mjs` | Self test and the notice about newer Ember or Foundry versions |
| `scripts/config.mjs` | Constants (tested versions, transitions) and small helpers |
| `templates/gallery.hbs` | Gallery window |
| `tests/` | Node tests (`node --test`) |

Validation and release:

```text
npm run check
npm run check:manifest
npm test
npm run release:prepare
```

## License

See [LICENSE.md](LICENSE.md).
