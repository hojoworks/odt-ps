/* Shared page behaviour: clipboard copying for anything with data-copy.
 * uBlock Origin and friends can hook the clipboard API (ClickFix protection),
 * so a rejected promise is not a reliable failure signal: we detect the hook,
 * fall back to execCommand, and finally select the text and ask for Ctrl+C.
 */
(function () {
  "use strict";

  function clipboardLooksHooked() {
    try {
      var write = navigator.clipboard && navigator.clipboard.writeText;
      if (!write) { return true; }
      return !/\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(write));
    } catch (err) {
      return false;
    }
  }

  function selectContents(node) {
    try {
      var range = document.createRange();
      range.selectNodeContents(node);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch (err) {
      return false;
    }
  }

  function flash(button, message) {
    if (!button) { return; }
    if (!button.getAttribute("data-original-label")) {
      button.setAttribute("data-original-label", button.textContent);
    }
    clearTimeout(button.__flashTimer);
    button.textContent = message;
    button.__flashTimer = setTimeout(function () {
      button.textContent = button.getAttribute("data-original-label");
    }, 2600);
  }

  function copyViaTextarea(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  function copy(text, button, sourceNode) {
    if (clipboardLooksHooked() && sourceNode && selectContents(sourceNode)) {
      flash(button, "Press Ctrl+C");
      return;
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        flash(button, "Copied!");
      }, function () {
        finish(text, button, sourceNode);
      });
    } else {
      finish(text, button, sourceNode);
    }
  }

  function finish(text, button, sourceNode) {
    if (copyViaTextarea(text)) { flash(button, "Copied!"); return; }
    if (sourceNode && selectContents(sourceNode)) { flash(button, "Press Ctrl+C"); return; }
    flash(button, "Copy blocked");
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest ? event.target.closest("[data-copy]") : null;
    if (!button) { return; }
    var selector = button.getAttribute("data-copy");
    var node = document.querySelector(selector);
    if (!node) { return; }
    copy(node.textContent, button, node);
  });

  /* ---------------------------------------------------------- screen title --
   * The title is drawn to a canvas and quantised to palette colours so it
   * belongs to a 16-colour screen, but it is rendered at 1:1 with a heavy
   * italic face: its pixels are finer than the 2px backdrop dots, and its
   * drop shadow is solid rather than screened so it reads clearly.
   */
  function drawPixelTitle(element) {
    var text = element.textContent.trim();
    var FONT = 46;
    var OFFSET = 6;                                  // shadow offset, in pixels
    var FACES = '"Arial Black", "Franklin Gothic Heavy", Impact, "Segoe UI", Arial, sans-serif';
    var font = "italic 900 " + FONT + "px " + FACES;

    var probe = document.createElement("canvas").getContext("2d");
    probe.font = font;

    var width = Math.ceil(probe.measureText(text).width) + OFFSET * 2 + 2;
    var height = Math.ceil(FONT * 1.25) + OFFSET * 2 + 2;

    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.className = "screen-title is-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", text);

    var ctx = canvas.getContext("2d");
    ctx.font = font;
    ctx.textBaseline = "top";

    /* the shadow is drawn twice, a pixel apart, so it reads thicker than the
       letters, and then thinned to a 50% dither: half its pixels go
       transparent and let the backdrop through */
    ctx.fillStyle = "#000080";
    ctx.fillText(text, OFFSET, OFFSET);
    ctx.fillText(text, OFFSET + 1, OFFSET + 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, 0, 0);

    /* hard edges, and only colours a 16-colour screen could show */
    var image = ctx.getImageData(0, 0, width, height);
    var data = image.data;
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var i = (y * width + x) * 4;
        if (data[i + 3] < 128) { data[i + 3] = 0; continue; }
        var isWhite = data[i] > 100 && data[i + 1] > 100;
        if (isWhite) {
          data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
        } else if ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0) {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 128; data[i + 3] = 255;
        } else {
          data[i + 3] = 0;                            /* dithered away */
        }
      }
    }
    ctx.putImageData(image, 0, 0);

    /* Crop to the ink. The canvas carries a few blank rows above the letters and
       below the descenders, and those would otherwise decide the spacing: the
       asymmetry between them is a font detail. Cropped, the CSS padding is the
       only thing setting the space above and below the title, so the two match. */
    var top = height, bottom = -1, left = width, right = -1;
    for (var row = 0; row < height; row++) {
      for (var column = 0; column < width; column++) {
        if (!data[(row * width + column) * 4 + 3]) { continue; }
        if (row < top) { top = row; }
        if (row > bottom) { bottom = row; }
        if (column < left) { left = column; }
        if (column > right) { right = column; }
      }
    }
    if (bottom >= 0) {
      var cropped = document.createElement("canvas");
      cropped.width = right - left + 1;
      cropped.height = bottom - top + 1;
      cropped.className = "screen-title is-canvas";
      cropped.setAttribute("role", "img");
      cropped.setAttribute("aria-label", text);
      cropped.getContext("2d").drawImage(canvas, -left, -top);
      canvas = cropped;
    }

    element.parentNode.insertBefore(canvas, element);
    element.remove();
  }

  function renderScreenTitle() {
    var title = document.querySelector(".screen-title");
    if (!title || title.tagName === "CANVAS") { return; }
    try {
      drawPixelTitle(title);
    } catch (err) {
      /* keep the plain text version if the canvas is unavailable */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderScreenTitle);
  } else {
    renderScreenTitle();
  }

  /* ------------------------------------------------------------- greeter --
   * The bar along the bottom used to name the section you were in, which the
   * rail already said and nobody needed twice. It now does what a status bar of
   * the era really did: it scrolls a line of credits past, the way a demoscene
   * greeter did. The track is filled with the line twice, so travelling half its
   * width lands on the same picture and the loop has no seam; the duration is
   * worked out from the width of one copy, so the line always moves at the same
   * pace however long the credits grow. */

  var GREETER_LINES = [
    "GREETZ TO JIM AND THE SPICY BOYS!",
    "Big shoutoutz to all the spreadsheet warriors, deployment wizards, XML cowboys, and IT legends keeping the information superhighway alive.",
    "KEEP YOUR CONFIGS CLEAN, YOUR INSTALLS SILENT, YOUR LICENSES LEGIT, AND YOUR TELEMETRY DISABLED.",
    "NO BLOAT. NO NONSENSE.",
    "SPECIAL GREETZ TO EVERYONE STILL KEEPING THE OLD SCHOOL SCENE ALIVE IN 2026.",
    "... AND REMEMBER ...",
    "REAL Gs DEPLOY WITH XML.",
    "LICENSED TO INSTALL. CONFIGURED TO THRILL."
  ];
  var GREETER_SPEED = 55;               /* pixels a second, however long the line is */
  var GREETER_SEPARATOR = " \u00b7 ";   /* the demoscene middle dot */

  function installGreeter() {
    var track = document.getElementById("greeter-track");
    if (!track) { return; }

    var line = GREETER_LINES.join(GREETER_SEPARATOR) + GREETER_SEPARATOR;
    track.textContent = line + line;

    /* One still copy for anyone reading the page with a screen reader: a line
       that never stops moving is no way to deliver a credit. Every line ends in
       its own punctuation, so a plain space joins them into readable prose. */
    var credits = document.getElementById("greeter-credits");
    if (credits) { credits.textContent = GREETER_LINES.join(" "); }

    /* Measured after a paint, so the line is laid out at its final width. These
       are system fonts, so there is no webfont arriving later to change it. */
    requestAnimationFrame(function () {
      var copy = track.scrollWidth / 2;
      if (copy > 0) {
        track.style.animationDuration = (copy / GREETER_SPEED).toFixed(1) + "s";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installGreeter);
  } else {
    installGreeter();
  }

  /* ------------------------------------------------------------- scrolling --
   * The window has one big scroll area (the sections) and several small ones
   * inside it (the pick lists, the rail, the XML box). The page itself never
   * scrolls, so a wheel event over the rail or the status bar used to scroll
   * nothing at all. Instead: walk up from the pointer, let the first thing that
   * can still scroll have the event, and otherwise move the sections ourselves
   * and swallow it.
   */
  function canScroll(element, delta) {
    if (!element || element.nodeType !== 1) { return false; }
    if (element.scrollHeight <= element.clientHeight + 1) { return false; }
    if (!/(auto|scroll)/.test(getComputedStyle(element).overflowY)) { return false; }
    if (delta > 0) { return element.scrollTop + element.clientHeight < element.scrollHeight - 1; }
    if (delta < 0) { return element.scrollTop > 0; }
    return false;
  }

  /* An inner list that has just run out of room holds the wheel for one notch
     before the window takes over: reaching the end of a list should not fling
     the page on the very next tick, but the hold has to stay short or the page
     feels stuck. */
  var CHAIN_BUFFER_MS = 120;

  /* The dithered shadows at the edges of the scrolling area only belong there
     while there is something left to scroll to in that direction. */
  function installEdgeBands(content) {
    function update() {
      content.classList.toggle("has-above", content.scrollTop > 1);
      content.classList.toggle("has-below",
        content.scrollTop + content.clientHeight < content.scrollHeight - 2);
    }
    var queued = false;
    function queue() {
      if (queued) { return; }
      queued = true;
      requestAnimationFrame(function () { queued = false; update(); });
    }
    content.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    if (typeof MutationObserver === "function") {
      /* the sections rebuild themselves as choices change, which moves the end
         of the scroll range without any scroll event */
      new MutationObserver(queue).observe(content, { childList: true, subtree: true });
    }
    update();
  }

  function installScrolling() {
    var content = document.querySelector(".setup-content");
    if (!content) { return; }
    var bufferUntil = 0;
    installEdgeBands(content);

    document.addEventListener("wheel", function (event) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey) { return; }
      var delta = event.deltaY;
      if (event.deltaMode === 1) { delta *= 16; }
      else if (event.deltaMode === 2) { delta *= content.clientHeight; }
      if (!delta) { return; }

      for (var node = event.target; node && node !== content; node = node.parentElement) {
        var scrollable = node.scrollHeight > node.clientHeight + 1 &&
          /(auto|scroll)/.test(getComputedStyle(node).overflowY);
        if (!scrollable) { continue; }
        if (canScroll(node, delta)) {
          bufferUntil = 0;                        /* it moved: arm the hold again */
          return;
        }
        /* full in this direction: hold the wheel for one notch, then hand over */
        if (bufferUntil === 0) {
          bufferUntil = Date.now() + CHAIN_BUFFER_MS;
          event.preventDefault();
          return;
        }
        if (Date.now() < bufferUntil) { event.preventDefault(); return; }
        break;
      }

      var before = content.scrollTop;
      content.scrollTop = before + delta;
      if (content.scrollTop !== before) { event.preventDefault(); }
    }, { passive: false });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installScrolling);
  } else {
    installScrolling();
  }

  /* Every file merges into the one namespace rather than replacing it. */
  var SETUP = window.SETUP = window.SETUP || {};
  SETUP.copy = copy;
  SETUP.flash = flash;
  SETUP.renderScreenTitle = renderScreenTitle;
})();
