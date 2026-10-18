/* The rail down the left of the window: it reports the current state rather than
 * changing it, and it marks the step the reader chose. Only a click moves that
 * mark, so the rail never twitches as the page scrolls under it. */

(function () {
  "use strict";

  var SETUP = window.SETUP, ODT = window.ODT;
  var core = SETUP.core;
  var escapeHtml = core.escapeHtml, view = core.view, elements = core.elements, SECTIONS = core.SECTIONS;
  var buildSummaryText = core.buildSummaryText, excludedNames = core.excludedNames;
  var languageNames = core.languageNames, versionName = core.versionName;
  var channelLabel = core.channelLabel;
  var appsNote = SETUP.sections.appsNote;

  /* ------------------------------------------------------------- chrome */

  /* The rail is rebuilt on every change otherwise, which throws away the same
     HTML and, if the rail has been scrolled, the reader's place with it. Both
     blocks remember what they were last drawn from. */
  var lastSteps = null;
  var lastSettings = null;

  function renderRail(current) {
    var steps = SECTIONS.map(function (section) {
      /* A button, not an anchor: this moves the page, it does not name a place in
         it, so there is no hash to leave behind in the address bar. */
      return '<li class="' + (section.id === view.activeSection ? "current" : "") + '">' +
        '<button type="button" class="step" data-section="' + section.id + '">' +
        '<span class="step-marker" aria-hidden="true"></span>' +
        '<span class="step-name">' + escapeHtml(section.label) + "</span></button></li>";
    }).join("");
    if (steps !== lastSteps) {
      lastSteps = steps;
      elements.railSteps.innerHTML = steps;
    }

    var rows = [
      ["Version", versionName(current)],
      ["Channel", channelLabel(ODT.resolveChannel(current)) || "none"],
      ["Build", buildSummaryText()],
      ["Excluding", excludedNames().length ? excludedNames().join(", ") : "none"],
      ["Languages", languageNames().length ? languageNames().join(", ") : "none, so English is used"]
    ];
    var settings = rows.map(function (row) {
      return "<dt>" + escapeHtml(row[0]) + "</dt><dd>" + escapeHtml(row[1]) + "</dd>";
    }).join("");
    if (settings !== lastSettings) {
      lastSettings = settings;
      elements.railSettings.innerHTML = settings;
    }

    elements.appsNote.textContent = appsNote(current);
  }

  /* ------------------------------------------------------------- render */

  /* Each section remembers the input it was built from, so a change in one
     place rebuilds only the sections it affects. The install section shows the
     generated XML, so it follows the whole state. */
  SETUP.rail = { render: renderRail };
})();
