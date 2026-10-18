/* The generated backdrop, the pixel title, the icon sheet and the scrollbars
   they are drawn with. */

export async function run(ctx) {
  const { client, check, evaluate, wait, waitFor, pickVersion, XML_IS_CONSISTENT } = ctx;
  /* ---- the icon sheet ---- */
  /* Both icons are in the always-rendered window chrome: the 26px one used to be
     the Manual Install heading, which sits in a shut <details>, and Chrome gives
     an element in skipped content a width of 0 wherever it runs. */
  const sprite = await evaluate(client,
    "(function () {" +
    "  var small = document.querySelector('.icon.i-save-16');" +
    "  var large = document.querySelector('.icon.i-copy-26');" +
    "  var a = getComputedStyle(small), b = getComputedStyle(large);" +
    "  return { image: a.backgroundImage.indexOf('icons.png') !== -1," +
    "           repeat: a.backgroundRepeat, small: a.backgroundPosition, large: b.backgroundPosition," +
    "           smallSize: a.width, largeSize: b.width," +
    "           rendering: a.imageRendering, symbols: document.querySelectorAll('symbol').length };" +
    "})()");
  check("icons paint from one sheet, 16 and 26 px at their own size, no inline symbols",
    sprite.image && sprite.repeat === "no-repeat" && sprite.small === "-96px 0px" &&
    sprite.large === "-26px -16px" && sprite.smallSize === "16px" && sprite.largeSize === "26px" &&
    sprite.rendering === "pixelated" && sprite.symbols === 0, JSON.stringify(sprite));

  /* The check and the dot are the browser's own, tinted with the page accent,
     so they need no sheet cell and stay sharp at any display scale. */
  const controls = await evaluate(client,
    "(function () {" +
    "  var tick = document.querySelector('#apps-body input[type=checkbox]:checked');" +
    "  var dot = document.querySelector('#edition-body input[type=radio]:checked');" +
    "  var t = getComputedStyle(tick), d = getComputedStyle(dot);" +
    "  return { tickNative: t.appearance !== 'none' && t.backgroundImage === 'none'," +
    "           tickAccent: t.accentColor, dotNative: d.appearance !== 'none' && d.backgroundImage === 'none'," +
    "           dotAccent: d.accentColor };" +
    "})()");
  check("the checkbox tick and radio dot are the browser's own, in the page navy",
    controls.tickNative && controls.dotNative &&
    controls.tickAccent === "rgb(0, 0, 128)" && controls.dotAccent === "rgb(0, 0, 128)",
    JSON.stringify(controls));

  /* ---- dithered backdrop ---- */
  const backdrop = await evaluate(client,
    "(function () {" +
    "  var cs = getComputedStyle(document.querySelector('.backdrop'));" +
    "  return { image: cs.backgroundImage.indexOf('backdrop.svg') !== -1, repeat: cs.backgroundRepeat," +
    "           size: cs.backgroundSize, colour: cs.backgroundColor };" +
    "})()");
  check("backdrop paints the generated ramp, 8 px dots, black below",
    backdrop.image && backdrop.repeat === "repeat-x" && backdrop.size.indexOf("8px") === 0 &&
    backdrop.colour === "rgb(0, 0, 0)", JSON.stringify(backdrop));

  /* ---- the screen title ---- */
  const title = await evaluate(client,
    "(function () {" +
    "  var c = document.querySelector('canvas.screen-title');" +
    "  if (!c) { return null; }" +
    "  var ctx = c.getContext('2d');" +
    "  var d = ctx.getImageData(0, 0, c.width, c.height).data;" +
    "  var colours = {}, navy = 0, run = 0, maxRun = 0, allRight = -1, allBottom = -1, whiteRight = -1, whiteBottom = -1;" +
    "  for (var y = 0; y < c.height; y++) {" +
    "    run = 0;" +
    "    for (var x = 0; x < c.width; x++) {" +
    "      var i = (y * c.width + x) * 4;" +
    "      if (d[i + 3] === 0) { run = 0; continue; }" +
    "      colours[d[i] + ',' + d[i + 1] + ',' + d[i + 2]] = 1;" +
    "      if (d[i] > 100) { run = 0; if (x > whiteRight) { whiteRight = x; } if (y > whiteBottom) { whiteBottom = y; } }" +
    "      else { navy++; run++; if (run > maxRun) { maxRun = run; } }" +
    "      if (x > allRight) { allRight = x; } if (y > allBottom) { allBottom = y; }" +
    "    }" +
    "  }" +
    "  return { colours: Object.keys(colours).sort().join(' | '), navy: navy, maxRun: maxRun," +
    "           scale: c.clientWidth / c.width, offset: Math.min(allRight - whiteRight, allBottom - whiteBottom)," +
    "           rendering: getComputedStyle(c).imageRendering };" +
    "})()");
  check("title is a pixel canvas in palette colours only, drawn at 1:1",
    title && title.rendering === "pixelated" && title.scale === 1 && title.colours === "0,0,128 | 255,255,255",
    JSON.stringify(title));
  check("title shadow is dithered, never a solid run of navy, and clearly offset",
    title && title.navy > 0 && title.maxRun <= 2 && title.offset >= 5, JSON.stringify(title));
}
