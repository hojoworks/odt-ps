/* The one place that knows how to drive headless Chrome over the DevTools
 * protocol: find a browser, start it, connect, evaluate and wait. Used by
 * tools/browser-check.mjs and tools/screenshot.mjs, so neither carries its own
 * copy of the handshake.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
];

export function findBrowser() {
  return CANDIDATES.find((candidate) => existsSync(candidate)) || null;
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Fixed sleeps are the usual reason a browser suite goes flaky, so where the
   next step depends on the page settling, wait for the condition itself. */
export async function waitFor(probe, timeoutMs = 1500) {
  const start = Date.now();
  for (;;) {
    if (await probe()) { return true; }
    if (Date.now() - start >= timeoutMs) { return false; }
    await wait(50);
  }
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let nextId = 0;

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const entry = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) { entry.reject(new Error(message.error.message)); }
        else { entry.resolve(message.result); }
      }
    });
    socket.addEventListener("open", () => resolve({
      send(method, params) {
        return new Promise((res, rej) => {
          const id = ++nextId;
          pending.set(id, { resolve: res, reject: rej });
          socket.send(JSON.stringify({ id, method, params: params || {} }));
        });
      },
      close() { socket.close(); }
    }));
    socket.addEventListener("error", () => reject(new Error("websocket error")));
  });
}

async function findPageTarget(port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const list = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) { return page; }
    } catch (err) { /* not up yet */ }
    await wait(250);
  }
  throw new Error("DevTools endpoint never came up");
}

/* Start a browser on `url` and connect to its page. The returned close() shuts
   both the connection and the browser down and removes the temp profile. */
export async function open({ url, width = 1280, height = 900, port = 9333,
  flags = [], targetTimeout = 30000 }) {
  const browserPath = findBrowser();
  if (!browserPath) { return null; }
  const profile = mkdtempSync(join(tmpdir(), "odt-browser-"));
  const args = [
    "--headless=new",
    "--disable-gpu",
    /* Wheel input is animated by default; the checks want the jump it lands on. */
    "--disable-smooth-scrolling",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=" + width + "," + height,
    "--remote-debugging-port=" + port,
    "--user-data-dir=" + profile,
    ...flags,
    url
  ];
  /* CI containers need this; it is harmless elsewhere on Linux. */
  if (process.platform === "linux") { args.splice(1, 0, "--no-sandbox"); }

  const browser = spawn(browserPath, args, { stdio: "ignore" });
  const client = await connect((await findPageTarget(port, targetTimeout)).webSocketDebuggerUrl);

  return {
    client,
    close() {
      client.close();
      browser.kill();
      try { rmSync(profile, { recursive: true, force: true }); } catch (err) { /* gone */ }
    }
  };
}

export async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

/* The PNG of a rectangle of the page, base64, exactly as the protocol returns
   it: callers that want to look at it rather than write it (tools/make-card.mjs
   pastes one into a page) can. */
export async function captureData(client, clip) {
  const shot = await client.send("Page.captureScreenshot",
    { format: "png", captureBeyondViewport: true, clip });
  return shot.data;
}

/* Screenshot a rectangle of the page, in CSS pixels of the viewport. */
export async function capture(client, clip, outFile) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(outFile, Buffer.from(await captureData(client, clip), "base64"));
}
