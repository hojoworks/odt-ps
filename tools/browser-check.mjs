/* Browser behaviour checks: drives the real page in headless Chrome/Edge over
 * the DevTools protocol and asserts only what the DOM wiring is responsible
 * for. XML shape, command lines and size arithmetic belong to
 * tools/check-wizard.mjs, and generated assets are checked there too.
 *
 *   node tools/browser-check.mjs
 *   SETUP_URL=https://hojoworks.github.io/odt-ps/ node tools/browser-check.mjs
 *
 * Exits non-zero when a check fails; the browser is closed afterwards. The
 * Chrome/DevTools handling lives in tools/cdp.mjs, shared with screenshot.mjs.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findBrowser, open, evaluate, wait, waitFor } from "./cdp.mjs";
import * as layout from "./checks/layout.mjs";
import * as assets from "./checks/assets.mjs";
import * as lists from "./checks/lists.mjs";
import * as wiring from "./checks/wiring.mjs";
import * as scrolling from "./checks/scrolling.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = 9333;
const pageUrl = process.env.SETUP_URL || ("file:///" + join(root, "site", "index.html").replace(/\\/g, "/"));

if (!findBrowser()) {
  console.log("no Chrome/Edge found; skipping browser checks");
  process.exit(0);
}

let failures = 0;
function check(name, condition, detail) {
  if (condition) {
    console.log("ok   " + name);
  } else {
    failures++;
    /* One line, so the numbers travel with the message into the CI annotation. */
    console.log("FAIL " + name + (detail !== undefined ? " :: " + String(detail).slice(0, 400) : ""));
  }
}

/* The one integration assertion: whatever the page shows must be what the
   builder produces for the page's own state. */
const XML_IS_CONSISTENT =
  "document.getElementById('install-xml').textContent.trim() === ODT.buildXml(window.SETUP.api.effective()).trim()";

let session = null;
try {
  session = await open({ url: pageUrl, width: 1280, height: 900, port: port });
  const client = session.client;
  await wait(900);

  /* The page boots as scripts load, so wait for the hook rather than assuming a
     fixed delay is enough: a slow runner used to fail this intermittently. */
  const booted = await waitFor(async () =>
    (await evaluate(client, "typeof window.SETUP.api === 'object'")) === true, 8000);
  let bootDetail = "SETUP.api missing - a script failed to load";
  if (!booted) {
    bootDetail += " :: " + await evaluate(client,
      "(function () {" +
      "  var H = window.SETUP || {};" +
      "  return ['ODT:' + (typeof window.ODT), 'SETUP:' + (typeof window.SETUP)," +
      "          'app:' + (typeof H.app), 'sections:' + (typeof H.sections)," +
      "          'rail:' + (typeof H.rail), 'setup:' + (typeof window.SETUP.api)].join(' ');" +
      "})()");
  }
  check("setup script booted", booted, bootDetail);
  const pickVersion = async (product) => {
  await evaluate(client,
    "(function () {" +
    "  var box = document.querySelector('#version-body input[data-product=\"" + product + "\"]');" +
    "  box.checked = true;" +
    "  box.dispatchEvent(new Event('change', { bubbles: true }));" +
    "})()");
  await wait(150);
};

/* A fresh page: nothing chosen yet, and the apps list is greyed out but keeps
   exactly the size it will have once a version is picked. */
const fresh = await evaluate(client,
  "(function () {" +
  "  var list = document.querySelector('#apps-body .pick-list');" +
  "  return { product: window.SETUP.api.state().product," +
  "           ticked: document.querySelectorAll('#version-body input[data-product]:checked').length," +
  "           editionTicked: (document.querySelector('#edition-body input[name=arch]:checked') || {}).value," +
  "           idle: list.classList.contains('is-idle')," +
  "           disabled: list.querySelectorAll('input:disabled').length," +
  "           rows: list.querySelectorAll('.pick').length," +
  "           height: Math.round(list.getBoundingClientRect().height)," +
  "           opacity: getComputedStyle(list).opacity," +
  "           channelBlock: !!document.querySelector('#version-body .pick-side .channel-list')," +
  "           channelChoices: document.querySelectorAll('#version-body .pick-side .channel-list input[name=channel]:not(:disabled)').length," +
  "           channelHeight: Math.round((document.querySelector('#version-body .pick-side .channel-list') || { getBoundingClientRect: function () { return { height: 0 }; } }).getBoundingClientRect().height)," +
  "           languages: window.SETUP.api.state().languages.length," +
  "           uiLanguage: (document.querySelector('#ui-language') || {}).value," +
  "           installHidden: document.getElementById('s-install').hidden," +
  "           installIdle: !!document.querySelector('#install-body .build-cards.is-idle')," +
  "           installDim: Number(getComputedStyle(document.querySelector('#install-body .build-cards')).opacity)," +
  "           installCards: document.querySelectorAll('#install-body .build-card').length," +
  "           installDisabled: document.querySelectorAll('#install-body .btn:disabled').length," +
  "           install: document.getElementById('install-body').textContent.slice(0, 30) };" +
  "})()");
check("a fresh page has no version chosen, 64-bit ticked, and the apps list greyed but full size",
  fresh.product === "" && fresh.ticked === 0 && fresh.editionTicked === "64" &&
  fresh.idle === true && fresh.disabled === fresh.rows && fresh.rows === 12 &&
  fresh.height > 200 && Number(fresh.opacity) < 1 &&
  fresh.channelBlock === true && fresh.channelChoices === 0 && fresh.channelHeight === 72 &&
  /* no language is chosen until one is ticked */
  fresh.languages === 0 && fresh.uiLanguage === "" &&
  /* Install is visible but greyed and inert until a version is picked */
  fresh.installHidden === false && fresh.installIdle === true && fresh.installDim < 1 &&
  fresh.installCards === 3 && fresh.installDisabled === 4, JSON.stringify(fresh));

await pickVersion("O365ProPlusRetail");
const woken = await evaluate(client,
  "(function () {" +
  "  var list = document.querySelector('#apps-body .pick-list');" +
  "  return { product: window.SETUP.api.state().product," +
  "           idle: list.classList.contains('is-idle')," +
  "           disabled: list.querySelectorAll('input:disabled').length," +
  "           height: Math.round(list.getBoundingClientRect().height)," +
  "           channelRows: document.querySelectorAll('#version-body .pick-side input[name=channel]').length };" +
  "})()");
check("picking a version wakes the apps list up without moving it",
  woken.product === "O365ProPlusRetail" && woken.idle === false && woken.disabled === 0 &&
  woken.height === fresh.height && woken.channelRows === 3, JSON.stringify(woken));

  /* the areas below are the checks themselves, in the order they build on
     each other: layout, the drawn assets, the lists, the wiring, the scroll spy */
  const ctx = { client: client, check, evaluate, wait, waitFor, pickVersion, XML_IS_CONSISTENT };
  await layout.run(ctx);
  await assets.run(ctx);
  await lists.run(ctx);
  await wiring.run(ctx);
  await scrolling.run(ctx);

} catch (err) {
  failures++;
  console.log("FAIL browser run: " + err.message);
} finally {
  if (session) { session.close(); }
}

console.log("");
console.log(failures === 0 ? "browser checks passed" : failures + " browser check(s) failed");
process.exit(failures === 0 ? 0 : 1);
