/* The wiring: which section has to be rebuilt when, the events, the scroll spy
 * and the public hook the headless checks use. */

(function () {
  "use strict";

  var SETUP = window.SETUP, ODT = window.ODT;
  var core = SETUP.core, sections = SETUP.sections, rail = SETUP.rail;
  var escapeHtml = core.escapeHtml, state = core.state, view = core.view, elements = core.elements;
  var SECTIONS = core.SECTIONS, DEFAULTS = core.DEFAULTS;
  var clone = core.clone, effectiveState = core.effectiveState;
  var hasChoices = core.hasChoices, beforeUnloadWarning = core.beforeUnloadWarning;
  var toggleInArray = core.toggleInArray, buildOneLiner = core.buildOneLiner;


  function updateDescription(event) {
    var target = event.target;
    if (!target.closest) { return; }
    var pick = target.closest(".pick");
    if (!pick) { return; }
    var columns = pick.closest(".pick-columns");
    var pane = columns && columns.querySelector(".pick-desc p");
    if (!pane || pane.hasAttribute("data-fixed")) { return; }
    var note = pick.getAttribute("data-note");
    if (note) { pane.textContent = note; }
  }

  /* ------------------------------------------------------------- sections */

  /* The edition choice uses the same list + description shape as Version and
     Build: two rows, 64-bit ticked, and the old subtitle moved into the pane. */
  var rendered = {};

  /* Rebuilding a section's markup would send a scrolled list back to the top,
     which is maddening in a 95-row list of languages. Remember where each list
     was and put it back: the lists already carry the label they need. */
  function listScroll(node) {
    var found = {};
    Array.prototype.forEach.call(node.querySelectorAll(".pick-list"), function (list, index) {
      found[list.getAttribute("aria-label") || "list-" + index] = list.scrollTop;
    });
    return found;
  }

  function restoreListScroll(node, positions) {
    Array.prototype.forEach.call(node.querySelectorAll(".pick-list"), function (list, index) {
      var key = list.getAttribute("aria-label") || "list-" + index;
      if (positions[key]) { list.scrollTop = positions[key]; }
    });
  }

  function renderSection(name, signature, build) {
    if (rendered[name] === signature) { return; }
    rendered[name] = signature;
    var positions = listScroll(elements[name]);
    elements[name].innerHTML = build();
    restoreListScroll(elements[name], positions);
  }

  function render() {
    var current = effectiveState();

    renderSection("presets", "", function () { return sections.presets(); });

    renderSection("edition", JSON.stringify([current.product, current.arch]),
      function () { return sections.edition(current); });

    renderSection("version", JSON.stringify([current.product, current.channel, view.otherOpen]),
      function () { return sections.version(current); });

    renderSection("build", JSON.stringify([current.versionMode, current.version, current.matchInstalled]),
      function () { return sections.build(current); });

    renderSection("apps", JSON.stringify([current.product, current.addons, current.excludeApps]),
      function () { return sections.apps(current); });

    renderSection("languages", JSON.stringify([state.languages]),
      function () { return sections.languages(); });

    renderSection("options", JSON.stringify([state.removeMsi, state.removeExisting, state.sharedComputer,
      state.deviceBased, state.keepUpdated, state.displayLevel, state.keepFiles]),
      function () { return sections.options(current); });

    renderSection("install", JSON.stringify(current),
      function () { return sections.install(current); });

    rail.render(current);
  }

  /* ------------------------------------------------------------- events */

  function onChange(event) {
    var el = event.target;

    if (el.hasAttribute("data-product")) {
      /* one version at a time, and clicking the ticked one clears the choice so
         the Apps list goes back to being greyed out */
      state.product = el.checked ? el.getAttribute("data-product") : "";
    } else if (el.hasAttribute("data-addon")) {
      toggleInArray(state.addons, el.getAttribute("data-addon"), el.checked);
    } else if (el.hasAttribute("data-app")) {
      toggleInArray(state.excludeApps, el.getAttribute("data-app"), !el.checked);
    } else if (el.hasAttribute("data-lang")) {
      toggleInArray(state.languages, el.getAttribute("data-lang"), el.checked);
    } else if (el.id === "ui-language") {
      /* the UI language is simply the first one in the list: move the chosen
         language to the front and shift the rest along */
      var chosen = el.value;
      if (state.languages.indexOf(chosen) !== -1) {
        state.languages = [chosen].concat(state.languages.filter(function (id) {
          return id !== chosen;
        }));
      }
    } else if (el.id === "lang-matchos") {
      toggleInArray(state.languages, "MatchOS", el.checked);
    } else if (el.id === "version-input") {
      state.version = el.value.trim();
      render(); return;
    } else if (el.name === "versionMode") {
      state.versionMode = el.value;
    } else if (el.name === "arch") {
      state.arch = el.value;
    } else if (el.name === "channel") {
      state.channel = el.value;
    } else if (el.hasAttribute("data-opt")) {
      var key = el.getAttribute("data-opt");
      if (key === "displayLevelFull") { state.displayLevel = el.checked ? "Full" : "None"; }
      else { state[key] = el.checked; }
    } else {
      return;
    }
    render();
  }

  function onClick(event) {
    var el = event.target;
    if (!el.closest) { return; }

    /* A rail step glides to its section instead of jumping, and then hands the
       keyboard to the section list, so Page Down there scrolls the sections
       rather than the rail. Nothing is written to the address bar: the page does
       not treat its sections as linkable places. */
    var jump = el.closest("[data-section]");
    if (jump) {
      var target = document.getElementById(jump.getAttribute("data-section"));
      if (target) {
        event.preventDefault();
        var still = window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
        /* Move the mark now as well as scrolling: a step whose section is
           already in view scrolls nowhere, and the rail would stay on the old
           one until the next click. */
        moveRail(target.id);
        el.blur();
        if (elements.content) {
          elements.content.setAttribute("tabindex", "-1");
          elements.content.focus({ preventScroll: true });
        }
      }
      return;
    }

    var presetButton = el.closest("[data-preset]");
    if (presetButton) {
      core.applyPreset(presetButton.getAttribute("data-preset"));
      return;
    }

    var action = el.closest("[data-action]");
    if (action && action.getAttribute("data-action") === "save-xml") {
      saveXml();
    }
  }

  function saveXml() {
    var blob = new Blob([ODT.buildXml(effectiveState())], { type: "text/xml;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "configuration.xml";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  /* ------------------------------------------------------------- rail */

  /* The rail marks the step the reader chose. Nothing else moves it: what is on
     screen at any moment is the reader's business, and a highlight that chased
     the scroll would only ever be one wheel notch behind or ahead of them. A
     click names its section here, right away, which also covers the sections
     near the foot that cannot be scrolled to the top to prove it. */
  function moveRail(id) {
    if (id === view.activeSection) { return; }
    view.activeSection = id;
    rail.render(effectiveState());
  }

  /* ------------------------------------------------------------- init */

  function init() {
    elements.window = document.getElementById("setup-window");
    elements.railSteps = document.getElementById("rail-steps");
    elements.railSettings = document.getElementById("rail-settings");
    elements.presets = document.getElementById("presets-body");
    elements.edition = document.getElementById("edition-body");
    elements.version = document.getElementById("version-body");
    elements.build = document.getElementById("build-body");
    elements.languages = document.getElementById("languages-body");
    elements.apps = document.getElementById("apps-body");
    elements.options = document.getElementById("options-body");
    elements.install = document.getElementById("install-body");
    elements.appsNote = document.getElementById("apps-note");
    elements.content = document.querySelector(".setup-content");
    if (!elements.install) { return; }


    elements.window.addEventListener("change", onChange);
    elements.window.addEventListener("click", onClick);
    elements.window.addEventListener("mouseover", updateDescription);
    elements.window.addEventListener("focusin", updateDescription);
    /* toggling a <details> does not bubble, so catch it on the way down */
    elements.window.addEventListener("toggle", function (event) {
      if (event.target && event.target.classList &&
          event.target.classList.contains("pick-more")) {
        view.otherOpen = event.target.open;
      }
    }, true);
    window.addEventListener("beforeunload", beforeUnloadWarning);

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* Hook for the headless checks. */
  window.SETUP.api = {
    state: function () { return clone(state); },
    effective: effectiveState,
    render: render,
    reset: core.reset,
    oneLiner: buildOneLiner,
    willWarn: hasChoices
  };
  /* the state flows call back here, because this is where the cache lives */
  core.afterChange = function () { rendered = {}; render(); };
})();
