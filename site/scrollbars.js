/* Firefox overlay scrollbars.
 *
 * Firefox has no ::-webkit-scrollbar-* pseudo-elements, and its scrollbar-color
 * can only tint the native bar. This builds the same chunky bar out of real
 * elements over the scrollers that scrollbars.css styles in Chromium: the same
 * 16px sunken arrows, the same dithered track, the same chiselled thumb.
 *
 * Chromium and Safari paint the bars themselves and this does nothing. The
 * browser checks call SETUP.scrollbars.enable() to exercise the overlay there.
 *
 * The bars are fixed to the viewport, outside the scrollports that would clip
 * them, so each one is cut to the part of its scroller that is actually on
 * screen: a row far down a pick list, or a box below the fold of the sections,
 * must not paint its bar over other sections or off the page.
 */

(function () {
  "use strict";

  var SETUP = window.SETUP = window.SETUP || {};
  var SELECTOR = ".setup-content, .setup-rail, .pick-list, .cmd-box, .xml-box, .pick-desc p:not(.pick-tally)";
  var BAR = 16;
  var BUTTON = 16;
  var MIN_THUMB = 16;
  var STEP = 32;
  var REPEAT = 60;

  var items = [];
  var pending = false;
  var enabled = false;
  var resizeObserver = null;
  var bodyObserver = null;

  function thumbOf(item, axis) {
    return axis === "v" ? item.vThumb : item.hThumb;
  }

  function trackOf(item, axis) {
    return axis === "v" ? item.vTrack : item.hTrack;
  }

  function clampThumb(track, view, content) {
    if (track <= 0) { return 0; }
    var size = Math.round(track * view / content);
    if (size < MIN_THUMB) { size = MIN_THUMB; }
    return size > track ? track : size;
  }

  function intersect(a, b) {
    return {
      left: Math.max(a.left, b.left),
      top: Math.max(a.top, b.top),
      right: Math.min(a.right, b.right),
      bottom: Math.min(a.bottom, b.bottom)
    };
  }

  /* The clipping box of an ancestor, or null when it does not clip. A box with
     overflow-x hidden and overflow-y visible computes the pair as hidden and
     auto, so reading both is enough: either one clips. */
  function clipBoxOf(node, cache) {
    if (cache.has(node)) { return cache.get(node); }
    var style = window.getComputedStyle(node);
    var box = null;
    if (style.overflowX !== "visible" || style.overflowY !== "visible") {
      var rect = node.getBoundingClientRect();
      box = {
        left: rect.left + node.clientLeft,
        top: rect.top + node.clientTop,
        right: rect.left + node.clientLeft + node.clientWidth,
        bottom: rect.top + node.clientTop + node.clientHeight
      };
    }
    cache.set(node, box);
    return box;
  }

  /* What of the scroller is actually on screen: its own padding box, narrowed
     by every clipping ancestor between it and the page, then by the viewport.
     The bars are fixed to the viewport and belong to no clipping context, so
     without this a row scrolled out of its pick list still paints its bar over
     the sections below, and a box half off the window paints its bar past the
     window edge. */
  function visibleBox(el, box, cache) {
    var clip = box;
    var node = el.parentElement;
    while (node) {
      var outer = clipBoxOf(node, cache);
      if (outer) { clip = intersect(clip, outer); }
      node = node.parentElement;
    }
    return intersect(clip, {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight
    });
  }

  /* Clip a bar to the visible part of its scroller. The arrows stay where they
     are, so a bar cut off at the foot of a list shows its top arrow and drops
     the rest, the same way the browser's own bar is cut off by the scrollport.
     `box` is where the bar would sit without clipping. Returns false when none
     of it is left to show. */
  function clipBar(bar, box, visible) {
    var seen = intersect(box, visible);
    if (seen.right <= seen.left || seen.bottom <= seen.top) {
      bar.style.display = "none";
      return false;
    }
    bar.style.clipPath = "inset(" +
      Math.max(0, Math.round(seen.top - box.top)) + "px " +
      Math.max(0, Math.round(box.right - seen.right)) + "px " +
      Math.max(0, Math.round(box.bottom - seen.bottom)) + "px " +
      Math.max(0, Math.round(seen.left - box.left)) + "px)";
    return true;
  }

  function scrollStep(item, axis, direction) {
    var el = item.el;
    if (axis === "v") { el.scrollTop += direction * STEP; }
    else { el.scrollLeft += direction * STEP; }
    schedule();
  }

  function bindButton(item, button, axis, direction) {
    button.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) { return; }
      event.preventDefault();
      scrollStep(item, axis, direction);
      var timer = window.setInterval(function () { scrollStep(item, axis, direction); }, REPEAT);
      function stop() {
        window.clearInterval(timer);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      }
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    });
  }

  function bindThumb(item, axis) {
    var thumb = thumbOf(item, axis);
    thumb.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) { return; }
      event.preventDefault();
      var el = item.el;
      var startScroll = axis === "v" ? el.scrollTop : el.scrollLeft;
      var startPointer = axis === "v" ? event.clientY : event.clientX;
      var track = axis === "v" ? item.vTrack.clientHeight : item.hTrack.clientWidth;
      var thumbSize = axis === "v" ? thumb.offsetHeight : thumb.offsetWidth;
      var view = axis === "v" ? el.clientHeight : el.clientWidth;
      var content = axis === "v" ? el.scrollHeight : el.scrollWidth;
      var range = track - thumbSize;
      var max = content - view;
      if (range <= 0 || max <= 0) { return; }
      function move(moveEvent) {
        var delta = (axis === "v" ? moveEvent.clientY : moveEvent.clientX) - startPointer;
        var next = startScroll + (delta / range) * max;
        if (axis === "v") { el.scrollTop = next; } else { el.scrollLeft = next; }
      }
      function stop() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    });
  }

  function bindTrack(item, axis) {
    var track = trackOf(item, axis);
    track.addEventListener("pointerdown", function (event) {
      /* the thumb handles its own drag; only a bare track click pages */
      if (event.button !== 0 || event.target !== track) { return; }
      event.preventDefault();
      var el = item.el;
      var thumbRect = thumbOf(item, axis).getBoundingClientRect();
      var before = axis === "v" ? event.clientY < thumbRect.top : event.clientX < thumbRect.left;
      if (axis === "v") { el.scrollTop += before ? -el.clientHeight : el.clientHeight; }
      else { el.scrollLeft += before ? -el.clientWidth : el.clientWidth; }
      schedule();
    });
  }

  function part(className, html) {
    var el = document.createElement("div");
    el.className = className;
    el.setAttribute("aria-hidden", "true");
    if (html) { el.innerHTML = html; }
    return el;
  }

  function scrollable(style, axis) {
    var overflow = axis === "v" ? style.overflowY : style.overflowX;
    return overflow === "auto" || overflow === "scroll" || overflow === "overlay";
  }

  function createItem(el) {
    var item = { el: el, horizontal: el.classList.contains("cmd-box") || el.classList.contains("xml-box") };
    var style = window.getComputedStyle(el);
    item.scrollV = scrollable(style, "v");
    item.scrollH = scrollable(style, "h");
    item.v = part("ff-sb ff-sb-v",
      '<div class="ff-sb-btn ff-sb-up"></div>' +
      '<div class="ff-sb-track"><div class="ff-sb-thumb"></div></div>' +
      '<div class="ff-sb-btn ff-sb-down"></div>');
    item.v.style.display = "none";
    document.body.appendChild(item.v);
    item.vTrack = item.v.querySelector(".ff-sb-track");
    item.vThumb = item.v.querySelector(".ff-sb-thumb");
    bindButton(item, item.v.querySelector(".ff-sb-up"), "v", -1);
    bindButton(item, item.v.querySelector(".ff-sb-down"), "v", 1);
    bindThumb(item, "v");
    bindTrack(item, "v");

    if (item.horizontal) {
      item.h = part("ff-sb ff-sb-h",
        '<div class="ff-sb-btn ff-sb-left"></div>' +
        '<div class="ff-sb-track"><div class="ff-sb-thumb"></div></div>' +
        '<div class="ff-sb-btn ff-sb-right"></div>');
      item.h.style.display = "none";
      document.body.appendChild(item.h);
      item.hTrack = item.h.querySelector(".ff-sb-track");
      item.hThumb = item.h.querySelector(".ff-sb-thumb");
      bindButton(item, item.h.querySelector(".ff-sb-left"), "h", -1);
      bindButton(item, item.h.querySelector(".ff-sb-right"), "h", 1);
      bindThumb(item, "h");
      bindTrack(item, "h");
      item.corner = part("ff-sb-corner");
      item.corner.style.display = "none";
      document.body.appendChild(item.corner);
    }

    el.addEventListener("scroll", schedule);
    if (resizeObserver) { resizeObserver.observe(el); }
    el.__ffScrollbar = { vertical: item.v, horizontal: item.h };
    return item;
  }

  function destroyItem(item) {
    item.el.removeEventListener("scroll", schedule);
    if (resizeObserver) { resizeObserver.unobserve(item.el); }
    delete item.el.__ffScrollbar;
    item.v.remove();
    if (item.h) { item.h.remove(); }
    if (item.corner) { item.corner.remove(); }
  }

  function place(item, cache) {
    var el = item.el;
    if (!el.isConnected) { return; }
    var scrollsV = item.scrollV && el.scrollHeight > el.clientHeight + 1;
    var scrollsH = item.horizontal && item.scrollH && el.scrollWidth > el.clientWidth + 1;
    var barV = false;
    var barH = false;

    item.v.style.display = "none";
    if (item.h) { item.h.style.display = "none"; }
    if (item.corner) { item.corner.style.display = "none"; }
    if (!scrollsV && !scrollsH) { return; }

    var rect = el.getBoundingClientRect();
    var left = Math.round(rect.left + el.clientLeft);
    var top = Math.round(rect.top + el.clientTop);
    var width = el.clientWidth;
    var height = el.clientHeight;
    var box = { left: left, top: top, right: left + width, bottom: top + height };
    var visible = visibleBox(el, box, cache);

    if (scrollsV) {
      var vHeight = height - (scrollsH ? BAR : 0);
      var vTrack = vHeight - 2 * BUTTON;
      var vThumb = clampThumb(vTrack, height, el.scrollHeight);
      var vMax = el.scrollHeight - height;
      var vPos = vMax > 0 ? Math.round((vTrack - vThumb) * el.scrollTop / vMax) : 0;
      item.v.style.left = (left + width - BAR) + "px";
      item.v.style.top = top + "px";
      item.v.style.height = vHeight + "px";
      item.vThumb.style.height = vThumb + "px";
      item.vThumb.style.top = vPos + "px";
      barV = clipBar(item.v, { left: left + width - BAR, top: top,
        right: left + width, bottom: top + vHeight }, visible);
      if (barV) { item.v.style.display = ""; }
    }

    if (scrollsH) {
      var hWidth = width - (scrollsV ? BAR : 0);
      var hTrack = hWidth - 2 * BUTTON;
      var hThumb = clampThumb(hTrack, width, el.scrollWidth);
      var hMax = el.scrollWidth - width;
      var hPos = hMax > 0 ? Math.round((hTrack - hThumb) * el.scrollLeft / hMax) : 0;
      item.h.style.left = left + "px";
      item.h.style.top = (top + height - BAR) + "px";
      item.h.style.width = hWidth + "px";
      item.hThumb.style.width = hThumb + "px";
      item.hThumb.style.left = hPos + "px";
      barH = clipBar(item.h, { left: left, top: top + height - BAR,
        right: left + hWidth, bottom: top + height }, visible);
      if (barH) { item.h.style.display = ""; }
    }

    if (item.corner && barV && barH) {
      item.corner.style.left = (left + width - BAR) + "px";
      item.corner.style.top = (top + height - BAR) + "px";
      var corner = clipBar(item.corner, { left: left + width - BAR, top: top + height - BAR,
        right: left + width, bottom: top + height }, visible);
      if (corner) { item.corner.style.display = ""; }
    }
  }

  function find(el) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].el === el) { return items[i]; }
    }
    return null;
  }

  function refresh() {
    var els = document.querySelectorAll(SELECTOR);
    var seen = [];
    var cache = new Map();
    for (var i = 0; i < els.length; i++) {
      var item = find(els[i]);
      if (!item) {
        item = createItem(els[i]);
        items.push(item);
      }
      seen.push(item);
    }
    for (var j = items.length - 1; j >= 0; j--) {
      if (seen.indexOf(items[j]) === -1) {
        destroyItem(items[j]);
        items.splice(j, 1);
      }
    }
    for (var k = 0; k < items.length; k++) { place(items[k], cache); }
  }

  function schedule() {
    if (pending) { return; }
    pending = true;
    window.requestAnimationFrame(function () {
      pending = false;
      refresh();
    });
  }

  function enable() {
    if (enabled) { return; }
    enabled = true;
    document.documentElement.classList.add("ff-bars");
    resizeObserver = window.ResizeObserver ? new window.ResizeObserver(schedule) : null;
    window.addEventListener("resize", schedule);
    if (window.MutationObserver) {
      bodyObserver = new window.MutationObserver(schedule);
      /* The disclosure that holds the manual-install boxes changes only its
         `open` attribute, and a section can be shown or hidden without new
         children; both move or expose a scroller. Style changes are left out:
         the bars write their own and would keep scheduling. */
      bodyObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["open", "hidden", "class"]
      });
    }
    schedule();
  }

  var firefox = !!(window.CSS && window.CSS.supports && window.CSS.supports("-moz-appearance", "none"));
  if (firefox) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", enable);
    } else {
      enable();
    }
  }

  SETUP.scrollbars = { enable: enable, refresh: schedule };
})();
