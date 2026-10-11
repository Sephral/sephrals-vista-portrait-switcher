# Sephral’s Vista Portrait Switcher

Bring the NPCs in Ember's Vistas to life. Sephral’s Vista Portrait Switcher lets the GM change an NPC's portrait in the middle of a conversation: the merchant turns suspicious, the guard reaches for his sword, the innkeeper bursts out laughing. One click, and the figure changes with a soft transition.

## Discord

[![Join Discord](https://img.shields.io/badge/Discord-Join%20the%20community-5865F2?logo=discord&logoColor=white)](https://discord.gg/7BjCgDYaBP)

Questions, feedback, and module support are welcome on [Discord](https://discord.gg/7BjCgDYaBP).

## Demo

![SVPS demo](media/demo.gif)

The demo uses its own characters and a market backdrop of its own instead of Ember's artwork. If the embedded preview is not available in your GitHub view, please check the media folder.

## Features

* **Moods at a click:** right click an NPC in a Vista and pick a portrait from the palette in the token HUD. The figure changes with a soft transition, and the palette stays open for the next change.
* **A gallery per character:** as many portraits as you like, for moods, outfits, poses or disguises. Name them, sort them, mirror them.
* **Folder import:** point the gallery at a folder and every image becomes a portrait, named after its file.
* **Ember's own portraits:** Ember already ships more than one portrait for some NPCs, for example with a cloak or in festive clothes. Add them to the gallery and switch between them.
* **Fits any figure:** each portrait can have its own height, so kneeling or sitting figures keep the right size. The figure keeps its place in the Vista.
* **Groups of NPCs:** unlinked tokens switch one by one, so every guard of a squad can show a different mood.
* **Remembers the choice:** a linked character keeps its portrait, and new tokens in a Vista start with it.
* **Player characters too:** groups who place their heroes in Vistas can let players switch and edit their own portraits.
* **Soft transitions:** fade, swirl, morph, hologram and more of Foundry's token transitions.
* **English and German:** the module language follows Foundry or can be set per user.

## Usage

1. Enable the module in your Ember world.
2. Open the gallery of an NPC: right click the actor in the actor directory and choose *Vista portraits*, or use the entry in the header menu of the actor sheet.
3. Add images one by one or import a whole folder.
4. In a Vista, right click the NPC, click the mask button in the token HUD and pick a portrait. *Own portrait* brings back the actor image.

Changes are saved immediately and everyone sees them.

## Player characters

Ember designs Vistas as first person views: the players look at the scene through the eyes of their heroes, so usually only NPCs stand in them. If your group still places its heroes in Vistas, players can open the gallery of their own character, add and sort portraits and switch them in the token HUD just like the GM. Two world settings decide whether players may switch and whether they may edit.

## Settings

All options are in *Game Settings → Configure Settings → Sephral’s Vista Portrait Switcher*:

* Module language (follow Foundry, German or English)
* Whether players may switch and edit the portraits of their own characters
* Whether a switch changes a character in every Vista or only in the current one
* Whether new tokens start with the last portrait
* Transition type and duration
* An optional chat message for every change
* The mask button in the token HUD, per user
* A self test for the GM

## Requirements

* Foundry VTT 14 and the Ember module (with Crucible or D&D 5e)
* Works in Ember's Vista scenes. On other scenes the module stays out of the way.
* Verified with Foundry 14.369 and Ember 0.6.3. After an update of Ember or Foundry the GM gets a short notice, and the self test in the module settings checks that everything still works.

Install the module with its manifest URL `https://github.com/Sephral/sephrals-vista-portrait-switcher/releases/latest/download/module.json`.

Portraits work best as transparent full body figures with the feet at the lower edge, like Ember's own Vista portraits. Store them on your Foundry server so every player can load them.

## License

See [LICENSE.md](LICENSE.md).
