/* Build site/og-card.png: the setup window on the same dithered backdrop the
 * page paints, at the 1200x630 that link previewers crop around.
 *
 *   node tools/make-card.mjs [out.png] [url]
 *
 * This is the one generator that needs a browser, because the card is a
 * rendering of the page rather than a drawing of it. Like the other make-*
 * tools the result is committed and the suites read the committed file: CI has
 * no browser that could be trusted to lay out the same fonts.
 *
 * The window is captured at twice the size it ends up, so what smooths its text
 * is that downscale rather than whatever the previewer does with the finished
 * card. The backdrop is put back at its own scale rather than scaled with it,
 * so its dots stay the 2x2 pixels they are on the page.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findBrowser, open, evaluate, wait, captureData, capture } from "./cdp.mjs";

const CARD = { width: 1200, height: 630 };
const MARGIN = 20;                /* window face showing around the window */
const PAD = 6;                    /* room for the window's own drop shadow */
const VIEWPORT = { width: 1280, height: 900 };
const SHARPNESS = 2;              /* capture scale, before the card scales it down */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [outArg, urlArg] = process.argv.slice(2);
const outFile = outArg || join(root, "site", "og-card.png");
const pageUrl = urlArg || ("file:///" + join(root, "site", "index.html").replace(/\\/g, "/"));

if (!findBrowser()) {
  console.log("no Chrome/Edge found");
  process.exit(1);
}

let session = null;
try {
  session = await open({ url: pageUrl, width: VIEWPORT.width, height: VIEWPORT.height, port: 9351 });
  const client = session.client;
  await wait(1400);                        /* the page draws its title on a canvas */

  const box = await evaluate(client,
    "(function () {" +
    "  var r = document.querySelector('.setup-window').getBoundingClientRect();" +
    "  return { x: r.left, y: r.top, width: r.width, height: r.height };" +
    "})()");

  const source = { width: box.width + PAD * 2, height: box.height + PAD * 2 };
  const windowShot = await captureData(client, {
    x: box.x - PAD, y: box.y - PAD,
    width: source.width, height: source.height, scale: SHARPNESS
  });

  /* Fit the window in the card, keeping the margins equal on both axes. */
  const fit = Math.min((CARD.width - MARGIN * 2) / source.width,
    (CARD.height - MARGIN * 2) / source.height);
  const shown = { width: Math.round(source.width * fit), height: Math.round(source.height * fit) };
  const at = { x: Math.round((CARD.width - shown.width) / 2),
    y: Math.round((CARD.height - shown.height) / 2) };

  await evaluate(client,
    "(function () {" +
    "  var stage = document.createElement('div');" +
    "  stage.setAttribute('style', 'position:fixed;left:0;top:0;width:" + CARD.width +
    "px;height:" + CARD.height + "px;overflow:hidden;z-index:2147483647');" +
    "  var face = document.createElement('div');" +
    "  face.className = 'backdrop';" +
    "  face.setAttribute('style', 'inset:auto;position:absolute;left:0;top:0;width:" + CARD.width +
    "px;height:" + CARD.height + "px;z-index:0;background-size:8px " + CARD.height + "px;background-repeat:repeat-x');" +
    "  var shot = document.createElement('img');" +
    "  shot.alt = '';" +
    "  shot.setAttribute('style', 'position:absolute;left:" + at.x + "px;top:" + at.y +
    "px;width:" + shown.width + "px;height:" + shown.height + "px;z-index:1');" +
    "  shot.src = 'data:image/png;base64," + windowShot + "';" +
    "  stage.appendChild(face);" +
    "  stage.appendChild(shot);" +
    "  document.body.appendChild(stage);" +
    "  return shot.decode();" +        /* no capture until the window has decoded */
    "})()");

  await capture(client, { x: 0, y: 0, width: CARD.width, height: CARD.height, scale: 1 }, outFile);
  console.log("wrote " + outFile + " (" + CARD.width + "x" + CARD.height + ") from a " +
    Math.round(box.width) + "x" + Math.round(box.height) + " window");
} finally {
  if (session) { session.close(); }
}
