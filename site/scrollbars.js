/* Firefox overlay scrollbars.
 *
 * Firefox has no ::-webkit-scrollbar-* pseudo-elements, and its scrollbar-color
 * can only tint the native bar. This builds the same chunky bar out of real
 * elements over the scrollers that scrollbars.css styles in Chromium: the same
 * 16px sunken arrows, the same dithered track, the same chiselled thumb.
 *
 * Chromium and Safari paint the bars themselves and this does nothing. The
 * browser checks call SETUP.scrollbars.enable() to exercise the overlay there.
 */

(function () {
  "use strict";

  var SETUP = window.SETUP = window.SETUP || {};
  var SELECTOR = ".setup-content, .setup-rail, .pick-list, .xml-box, .pick-desc p:not(.pick-tally)";
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

  function createItem(el) {
    var item = { el: el, horizontal: el.classList.contains("xml-box") };
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

  function place(item) {
    var el = item.el;
    if (!el.isConnected) { return; }
    var rect = el.getBoundingClientRect();
    var left = Math.round(rect.left + el.clientLeft);
    var top = Math.round(rect.top + el.clientTop);
    var width = el.clientWidth;
    var height = el.clientHeight;
    var vertical = el.scrollHeight > el.clientHeight + 1;
    var horizontal = item.horizontal && el.scrollWidth > el.clientWidth + 1;

    item.v.style.display = vertical ? "" : "none";
    if (item.h) { item.h.style.display = horizontal ? "" : "none"; }
    if (item.corner) { item.corner.style.display = vertical && horizontal ? "" : "none"; }

    if (vertical) {
      var vHeight = height - (horizontal ? BAR : 0);
      var vTrack = vHeight - 2 * BUTTON;
      var vThumb = clampThumb(vTrack, height, el.scrollHeight);
      var vMax = el.scrollHeight - height;
      var vPos = vMax > 0 ? Math.round((vTrack - vThumb) * el.scrollTop / vMax) : 0;
      item.v.style.left = (left + width - BAR) + "px";
      item.v.style.top = top + "px";
      item.v.style.height = vHeight + "px";
      item.vThumb.style.height = vThumb + "px";
      item.vThumb.style.top = vPos + "px";
    }

    if (horizontal) {
      var hWidth = width - (vertical ? BAR : 0);
      var hTrack = hWidth - 2 * BUTTON;
      var hThumb = clampThumb(hTrack, width, el.scrollWidth);
      var hMax = el.scrollWidth - width;
      var hPos = hMax > 0 ? Math.round((hTrack - hThumb) * el.scrollLeft / hMax) : 0;
      item.h.style.left = left + "px";
      item.h.style.top = (top + height - BAR) + "px";
      item.h.style.width = hWidth + "px";
      item.hThumb.style.width = hThumb + "px";
      item.hThumb.style.left = hPos + "px";
    }

    if (item.corner && vertical && horizontal) {
      item.corner.style.left = (left + width - BAR) + "px";
      item.corner.style.top = (top + height - BAR) + "px";
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
    for (var k = 0; k < items.length; k++) { place(items[k]); }
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
      bodyObserver.observe(document.body, { childList: true, subtree: true });
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
