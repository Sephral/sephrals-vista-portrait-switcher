# Sephral’s Vista Portrait Switcher

Sephral’s Vista Portrait Switcher lets players and the GM change the portrait a character shows in Ember's Vista scenes on the fly – to show a mood, a pose or what the character is doing right now: reading, fighting, summoning, turning away.

In a Vista, Ember shows a hero as a standing full-body figure taken from the actor image. This module gives every character a gallery of such figures and a palette in the token HUD to switch between them with one click or a hotkey, with Foundry's soft texture transition.

## Discord

[![Join Discord](https://img.shields.io/badge/Discord-Join%20the%20community-5865F2?logo=discord&logoColor=white)](https://discord.gg/7BjCgDYaBP)

Questions, feedback, and module support are welcome on [Discord](https://discord.gg/7BjCgDYaBP).

## Overview

- A portrait gallery per character: add single images or import a whole folder
- Light variants: an image ending in `-light`/`-licht` becomes the variant of the same pose for dark scenes, switched with one button
- A figure height per pose (for kneeling or crouching poses) and mirroring
- Switch in the token HUD palette, with hotkeys (Alt+1 … Alt+9) or from the gallery
- The figure keeps its place and the direction it faces; the token is resized to the new image
- New Vista tokens of a character start with the portrait chosen last
- Unlinked NPC tokens switch one by one, so the GM can give every NPC its moods
- Optional chat notice, choice of transition, permissions for players
- Supports Foundry VTT v14 with Ember (Crucible or D&D 5e)
- Includes English and German translations

## Installation

Requirements: Foundry VTT 14 and the Ember module.

1. Install the module with its manifest URL `https://github.com/Sephral/sephrals-vista-portrait-switcher/releases/latest/download/module.json`, or unpack the release zip into `Data/modules/sephrals-vista-portrait-switcher/` (the folder name must match; `module.json` lies directly inside).
2. Enable the module in the world (*Manage Modules*, GM).
3. Make the portrait images available to everyone, e.g. in `assets/<player>/<character>/` of the world or the user data. Players without upload permission need the GM for this step.

The images should look like Ember's own Vista portraits: a transparent full-body figure in three-quarter view, feet at the lower edge. They must be loadable from the Foundry server or another source that allows cross-origin requests; images from web servers without CORS headers cannot be shown on the canvas.

## The gallery

Open it with

- the button *Vista portraits* in the header menu of the actor sheet,
- a right-click on the actor in the actor directory → *Vista portraits*, or
- the image button in the token HUD palette.

| Action | How |
| --- | --- |
| Add one image | *Add image* opens Foundry's file picker. Users who may not browse files get an empty portrait and type the image path |
| Import a folder | *Import folder* adds every image of a folder. Names come from the file names without their common beginning (`tharun-vista-blick-links.webp` → "Blick links"); the actor image comes first |
| Light variants | A file ending in `-licht`, `-light` or `-lit` (also with `_` or a space) becomes the light variant of the file with the same name – also of a portrait already in the gallery |
| Name | Text field of the portrait |
| Height | Height of the figure in feet. Empty: the character's portrait height (Ember's `flags.ember.portrait.height`). Use a lower value for kneeling or crouching figures |
| Mirror | The figure in this image faces the other way than in the character's own portrait |
| Order | Arrows; the first nine portraits get the hotkeys 1–9 |
| Remove | Bin; the image file stays |
| Show | Click the image |

Changes are saved immediately and appear for everyone. Re-importing a folder skips the images that are already in the gallery.

## Switching

- **Token HUD:** right-click the character in a Vista, click the mask button, click a portrait. The palette also has the light switch, the character's own portrait and the gallery. The HUD reopens after the transition, so the next portrait is one click away.
- **Hotkeys** (*Configure Controls*, changeable): they act on the selected tokens in the viewed Vista, or – with nothing selected – on your assigned character.

| Hotkey | Action |
| --- | --- |
| Alt+1 … Alt+9 | Portrait 1 … 9 |
| Alt+0 | The character's own portrait (the actor image) |
| Alt+Page Down / Alt+Page Up | Next / previous portrait |
| Alt+L | Light variants on/off |
| (none) | Open the gallery |

- **Gallery:** click a portrait.

What changes:

- **Characters (linked tokens):** all their Vista tokens, or only those in the current Vista (setting *A switch changes*). The character remembers the portrait and the light state; a new token placed in a Vista starts with them.
- **Unlinked tokens (NPCs):** only the token that was switched. From the gallery of such an actor the switch reaches the selected tokens.
- The figure keeps its place (Ember draws Vista tokens from their feet) and the direction it faces. Its size follows the portrait: the height of the pose, a width matching the image's proportions.
- The light switch keeps the pose. Portraits without a light variant stay as they are.

## Settings

| Setting | Scope | Default | Meaning |
| --- | --- | --- | --- |
| Players switch portraits | World | On | Players may switch the portraits of the characters they own |
| Players edit galleries | World | On | Players may edit the galleries of the characters they own |
| A switch changes | World | All Vista tokens | All Vista tokens of the character, or only those in the current Vista |
| New tokens keep the portrait | World | On | New Vista tokens of a character start with the portrait chosen last |
| Transition | World | Fade | Foundry's token transitions (fade, swirl, morph, hologram …) or none |
| Transition duration (ms) | World | 600 | Duration of the transition |
| Announce in chat | World | Off | A short chat message with the new portrait whenever a character changes its pose |
| Button in the token HUD | User | On | Show the mask button in the HUD of Vista tokens |

The GM can always switch and edit everything.

## Stored data

| Where | Key | Content |
| --- | --- | --- |
| Actor | `flags.sephrals-vista-portrait-switcher.poses` | The gallery: `{id, label, src, lightSrc, height, mirror, aspect, lightAspect}` |
| Actor | `flags.sephrals-vista-portrait-switcher.pose` / `.light` | The character's current portrait and light state |
| Token | `flags.sephrals-vista-portrait-switcher.pose` / `.light` | The portrait the token shows |
| Token | `texture.src`, `texture.scaleX`, `width`, `height`, `flags.ember.portrait` | Changed on every switch; *Own portrait* restores the values Ember uses |

`aspect` caches the proportions of an image, so a new token can be sized before the image is loaded.

## API

```js
const api = game.modules.get("sephrals-vista-portrait-switcher").api;
const tharun = game.actors.getName("Tharun");

await api.setPose(tharun, "Kampf");          // by name, id or number (1 = first portrait)
await api.setPose(tharun, 2, {light: true}); // second portrait, light variant
await api.resetPose(tharun);                 // the actor image
await api.stepPose(tharun, 1);               // next portrait
await api.toggleLight(tharun);
api.openGallery(tharun);
api.getPoses(tharun);                        // the gallery
api.poseState(tharun);                       // {pose, light}
```

A target can be an actor, a token, a token document, an actor id, name or UUID. The functions respect the permissions of the current user.

## Limitations

- Only Ember's Vista scenes. On other scenes the module does nothing; Ember's dynamic tokens stay as they are.
- Foundry redraws a token after a texture transition, which closes the token HUD; the module reopens it with the palette.
- The module relies on these Ember internals: Vistas are recognized through `CONFIG.Canvas.managedScenes` and Ember's `EmberVista` scene manager, sizes through `flags.ember.portrait`. Verified with Ember 0.6.2.

## Development

| File | Content |
| --- | --- |
| `scripts/svps.mjs` | Entry point: hooks and API |
| `scripts/settings.mjs` | Settings and hotkeys |
| `scripts/vista.mjs` | Vista detection, permissions, switching, new tokens |
| `scripts/poses.mjs` | Pure helpers: galleries, file import, portrait math (unit-tested) |
| `scripts/hud.mjs` | Token HUD button and palette |
| `scripts/gallery.mjs` | Gallery window |
| `scripts/controls.mjs` | Hotkey handlers, sheet header and actor directory entries |
| `scripts/config.mjs` | Constants and small helpers |
| `templates/gallery.hbs` | Gallery template |
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
