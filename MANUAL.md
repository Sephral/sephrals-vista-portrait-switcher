# Sephral’s Vista Portrait Switcher: Manual

This manual covers the details. For a quick overview see the [README](README.md).

## The gallery

Right click a character in the actor directory and choose *Vista portraits*, or open the gallery from the palette in the token HUD. Every character has its own gallery.

* **Add image** picks one image, **Import folder** adds every image of a folder at once. Images that are already in the gallery are skipped.
* **Suggest alternates** looks next to the actor image and the token image for images whose names start the same way, for example *merchant_angry.webp* next to *merchant.webp*. That also finds the extra portraits Ember ships for some NPCs.
* **Name** each portrait, sort it to the front or the back, or remove it. Removing only takes it out of the gallery, the file stays.
* **Height** in feet keeps kneeling or sitting figures at the right size. Empty means the height of the character's own portrait.
* **Mirror** flips a figure that faces the other way than the character's own portrait.
* Click a portrait to show it. Changes in the gallery are saved at once.
* The gear in the title bar opens the settings of the module.

## Switching in a Vista

Right click a character's token in a Vista and click the mask button in the token HUD. The palette lists the portraits of the gallery, the first entry shows the character's own portrait again. The palette stays open for the next change. Everyone sees the switch right away, with the transition from the settings.

Tokens that are not linked to their actor switch alone, so every guard of a squad can show a different mood. For linked characters the setting *A switch changes* decides whether every Vista changes or only the current one.

## Settings

All options are in *Game Settings → Configure Settings → Sephral’s Vista Portrait Switcher*:

| Setting | What it does |
| --- | --- |
| Language | Follow Foundry, German or English, for you |
| Players switch portraits | Players may switch the Vista portraits of the characters they own (GM) |
| Players edit galleries | Players may add, rename and remove the portraits of the characters they own (GM) |
| A switch changes | All Vista tokens of the character, or only the tokens in the current Vista (GM) |
| New tokens keep the portrait | A character placed in a Vista starts with the portrait chosen last (GM) |
| Announce in chat | A short chat message with the new portrait after every switch (GM) |
| Transition | How the old portrait turns into the new one: none, fade, swirl, morph, hologram and more (GM) |
| Transition duration (ms) | Duration of the transition (GM) |
| Button in the token HUD | The mask button with the palette (for you) |
| Self test | Checks the connection to Ember's Vistas and every image of every gallery (GM) |

## Self test

After an update of Ember or Foundry the GM gets a short notice. The self test in the settings checks that Ember's Vistas can still be found, loads every image of every gallery and posts the result as a chat message only the GM sees, with the images that cannot be loaded.

## API

`game.modules.get("sephrals-vista-portrait-switcher").api` offers:

| Function | What it does |
| --- | --- |
| `setPose(target, pose)` | Shows a portrait on a token or character, by id, name or number. `null` shows the character's own portrait |
| `resetPose(target)` | Shows the character's own portrait again |
| `stepPose(target, step)` | Shows the next (`1`) or previous (`-1`) portrait |
| `getPoses(actor)` | The gallery of a character |
| `savePoses(actor, poses)` | Stores a gallery on a character |
| `posesOf(target)` | The usable portraits of a token or character |
| `poseState(target)` | The current portrait of a token or character |
| `openGallery(actor)` | Opens the gallery of a character |
| `isVistaScene(scene)` | Whether a scene is an Ember Vista |
| `openSettings()` | Opens the settings of the module |
| `runSelfTest()` | Runs the self test (GM) |

## Limits

* The module needs your copy of the Ember module and contains no Ember content itself. On scenes that are not Vistas it stays out of the way.
* Portraits look best as transparent full body figures with the feet at the lower edge, like Ember's own Vista portraits.
