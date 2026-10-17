/* Screenshot a selector from the setup page, using headless Chrome over the
 * DevTools protocol. No npm dependencies, and no browser handling of its own:
 * that lives in tools/cdp.mjs.
 *
 *   node tools/screenshot.mjs <selector> <out.png> [viewportWidth] [setup] [url]
 *
 * The element is captured in full, even if it is taller than the viewport.
 * A section inside the scrolling area is scrolled into view first, and an
 * optional `setup` snippet runs before the shot (e.g. clicking a row so the
 * capture shows the list alive).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findBrowser, open, evaluate, wait, capture } from "./cdp.mjs";

const [selector, outFile, widthArg, setupArg, urlArg] = process.argv.slice(2);
if (!selector || !outFile) {
  console.log("usage: node tools/screenshot.mjs <selector> <out.png> [width] [setup] [url]");
  process.exit(2);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (!findBrowser()) {
  console.log("no Chrome/Edge found");
  process.exit(1);
}

const pageUrl = urlArg || ("file:///" + join(root, "site", "index.html").replace(/\\/g, "/"));
let session = null;

try {
  session = await open({ url: pageUrl, width: Number(widthArg || 1280), height: 900, port: 9345 });
  const client = session.client;
  await wait(1200);

  if (setupArg) {
    await evaluate(client, setupArg);
    await wait(300);
  }

  /* A section inside the scrolling area would otherwise be clipped by it. */
  await evaluate(client, `(function () {
    var el = document.querySelector(${JSON.stringify(selector)});
    if (el && el.scrollIntoView) { el.scrollIntoView({ block: "center" }); }
  })()`);
  await wait(200);

  const box = await evaluate(client,
    `(function () {
       var el = document.querySelector(${JSON.stringify(selector)});
       if (!el) { return null; }
       var r = el.getBoundingClientRect();
       return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
     })()`);

  if (!box) { throw new Error("selector not found: " + selector); }

  await capture(client, { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 }, outFile);
  console.log(`wrote ${outFile} (${Math.round(box.width)}x${Math.round(box.height)})`);
} catch (err) {
  console.error("error: " + err.message);
  process.exitCode = 1;
} finally {
  if (session) { session.close(); }
}
