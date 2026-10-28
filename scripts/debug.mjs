/**
 * The part of the Vista Portrait Switcher in the debug file of Sephral's modules: verified and installed versions,
 * how many characters have a gallery and which scenes are Vistas. The module reads no chat messages.
 */

import {MODULE_ID, TESTED_VERSIONS} from "./config.mjs";
import {registerDebugProvider} from "./debug-file.mjs";
import {getPoses, isVistaScene} from "./vista.mjs";

/**
 * The state of the module in short.
 * @returns {object}
 */
export function describeState() {
  const ember = game.modules.get("ember");
  const galleries = game.actors.map(actor => getPoses(actor).length).filter(count => count > 0);
  const vistas = game.scenes.filter(scene => isVistaScene(scene));
  return {
    tested: TESTED_VERSIONS,
    installed: {ember: ember?.active ? ember.version : null, core: game.version},
    galleries: {characters: galleries.length, portraits: galleries.reduce((sum, count) => sum + count, 0)},
    vistaScenes: vistas.map(scene => scene.id),
    viewedSceneIsVista: isVistaScene(game.scenes.viewed ?? null)
  };
}

/**
 * Register the module's part. Call in "init".
 */
export function registerDebug() {
  registerDebugProvider({
    moduleId: MODULE_ID,
    label: () => _loc("SVPS.DEBUG.Entry"),
    notice: file => _loc("SVPS.DEBUG.Saved", {file}),
    recent: () => ({details: describeState()})
  });
}
