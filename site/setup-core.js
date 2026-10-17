/* Hojo's Easy Configurator For ODT: the shared vocabulary. The defaults, the live
 * state object and the small helpers every other file reads. The state object is
 * never replaced, only refilled, so a reference to it stays good. */

(function () {
  "use strict";

  var SETUP = window.SETUP = window.SETUP || {};
  var ODT = window.ODT;
  var core = SETUP.core = {};
  var view = core.view = { otherOpen: false, activeSection: "" };

  /* where get.ps1 lives when the page is opened straight off disk */
  var DEFAULT_BASE = "https://hojoworks.github.io/odt-ps";


  var DEFAULTS = {
    product: "",
    addons: [],
    /* No language is chosen to start with: pick one from the list and it becomes
       the UI language, then any further ones are extra display languages. */
    languages: [],
      /* Nothing is excluded to start with: every row starts ticked. */
  excludeApps: [],
    versionMode: "latest",
    version: "",
    channel: "",
    arch: "64",
    removeMsi: true,
    removeExisting: false,
    sharedComputer: false,
    deviceBased: false,
    keepUpdated: true,
    /* The ODT folder is removed after a successful install unless this is asked
       for: several GB of files nobody needs twice. */
    keepFiles: false,
    /* The setup window is shown: a silent install is the exception, not the
       default, so nothing happens behind your back. */
    displayLevel: "Full",
    acceptEula: true,
    forceAppShutdown: true,
    matchOsFallback: "en-us",
    sourcePath: ""
  };

  /* The rail lists these and nothing more: the name is the whole step, so it can
     stay small and leave the height to the artwork at the foot of the rail. */
  var SECTIONS = [
    { id: "s-presets", label: "Configuration Presets" },
    { id: "s-edition", label: "Choose Edition" },
    { id: "s-version", label: "Choose Office Version Family" },
    { id: "s-build", label: "Choose Build Version" },
    { id: "s-apps", label: "Add / Remove Applications" },
    { id: "s-languages", label: "Choose Languages" },
    { id: "s-options", label: "Advanced options" },
    { id: "s-install", label: "Install" }
  ];

  var GROUPS = [
    { id: "common", label: "Microsoft 365 subscriptions" },
    { id: "volume", label: "Volume licences" },
    { id: "more", label: "Other" }
  ];

  var state = load();
  var elements = {};

  /* ------------------------------------------------------------- helpers */

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/>/g, "&gt;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function clone(object) { return JSON.parse(JSON.stringify(object)); }
  /* Every visit starts from the defaults: nothing is kept in the browser, so
     there is no half-remembered configuration to explain away. Refreshing with
     choices made triggers the browser's own "leave site?" warning, which
     beforeUnloadWarning installs. */
  function load() {
    return clone(DEFAULTS);
  }

  function hasChoices() {
    var pristine = clone(DEFAULTS);
    return JSON.stringify(state) !== JSON.stringify(pristine);
  }

  function beforeUnloadWarning(event) {
    if (!hasChoices()) { return undefined; }
    event.preventDefault();
    event.returnValue = "Refreshing or leaving will clear your choices.";
    return event.returnValue;
  }

  function toggleInArray(array, value, include) {
    var at = array.indexOf(value);
    if (include && at === -1) { array.push(value); }
    if (!include && at !== -1) { array.splice(at, 1); }
  }

  /* Shallow copy: every field we override is replaced with a new value, so the
     caller's state is never mutated. This used to be a JSON deep clone, which
     cost a full serialise/parse about ten times per render. */
  function effectiveState() {
    var copy = Object.assign({}, state);
    copy.matchInstalled = state.versionMode === "installed";
    copy.version = state.versionMode === "build" ? state.version : "";
    return copy;
  }

  function siteBase() {
    if (location.protocol === "http:" || location.protocol === "https:") {
      return location.origin + location.pathname.replace(/index\.html$/, "").replace(/\/$/, "");
    }
    return DEFAULT_BASE;
  }

  function channelInfo(channel) {
    return ODT.channelInfo[channel] || { note: "" };
  }

  /* "Current Channel" reads badly next to a group already called
     "Update channel", so the list drops the word. An unknown channel (nothing
     picked yet) is an empty label rather than a crash. */
  function channelLabel(channel) {
    var name = ODT.channelNames[channel];
    return name ? name.replace(/ Channel$/, "") : "";
  }

  function buildSummaryText() {
    if (state.versionMode === "installed") { return "match installed"; }
    if (state.versionMode === "build") { return state.version || "(no build yet)"; }
    if (!ODT.hasProduct(effectiveState())) { return "none"; }
    /* Deliberately no build number: Microsoft publishes a new one monthly, so
       we point at their update history instead of writing one down. */
    return "latest available";
  }

  function languageNames() {
    return state.languages.map(function (id) {
      return ODT.languageMap[id] ? ODT.languageMap[id].name : id;
    });
  }

  function excludedNames() {
    return state.excludeApps.map(function (id) { return ODT.appMap[id].name; });
  }

  function versionName(current) {
    var primary = ODT.primaryProduct(current);
    return primary ? primary.name : "no version chosen";
  }

  function buildOneLiner() {
    var args = ODT.buildCommand(effectiveState()).replace(/^\.\\get\.ps1\s*/, "");
    if (state.versionMode === "installed") {
      args = args.replace(" -Download", "");   // MatchInstalled never works with /download
    }
    return "$env:ODT_ARGS='" + args + "'; irm " + siteBase() + "/get.ps1 | iex";
  }

  /* Both flows replace the whole state, so the object itself is refilled rather
     than swapped: everything holding a reference keeps working. */
  function replaceState(next) {
    Object.keys(state).forEach(function (key) { delete state[key]; });
    Object.keys(next).forEach(function (key) { state[key] = next[key]; });
  }

  /* A whole-state change also means a different section is current, and the
     render cache has to go: the hook for that belongs to whoever owns the cache,
     so it is late-bound rather than imported. */
  function afterChange() {
    view.activeSection = SECTIONS[0].id;
    if (core.afterChange) { core.afterChange(); }
  }

  function reset() {
    replaceState(clone(DEFAULTS));
    afterChange();
  }

  function applyPreset(id) {
    var preset = ODT.presets.filter(function (candidate) { return candidate.id === id; })[0];
    if (!preset) { return; }
    /* a preset is a whole set of choices: start from the defaults, then apply */
    replaceState(Object.assign(clone(DEFAULTS), preset.state));
    afterChange();
  }
  /* everything above, named once */
  core.DEFAULTS = DEFAULTS;
  core.SECTIONS = SECTIONS;
  core.GROUPS = GROUPS;
  core.elements = elements;
  core.escapeHtml = escapeHtml;
  core.clone = clone;
  core.load = load;
  core.hasChoices = hasChoices;
  core.beforeUnloadWarning = beforeUnloadWarning;
  core.toggleInArray = toggleInArray;
  core.effectiveState = effectiveState;
  core.siteBase = siteBase;
  core.channelInfo = channelInfo;
  core.channelLabel = channelLabel;
  core.buildSummaryText = buildSummaryText;
  core.languageNames = languageNames;
  core.excludedNames = excludedNames;
  core.versionName = versionName;
  core.buildOneLiner = buildOneLiner;
  core.state = state;
  core.replaceState = replaceState;
  core.reset = reset;
  core.applyPreset = applyPreset;
  view.activeSection = SECTIONS[0].id;
})();
