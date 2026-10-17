/* The section builders: each one returns the HTML for one section's body (a pick
 * list and the blocks beside it). They read the state and build strings; they do
 * not touch the DOM. */

(function () {
  "use strict";

  var SETUP = window.SETUP, ODT = window.ODT;
  var core = SETUP.core;
  var escapeHtml = core.escapeHtml, state = core.state, view = core.view;
  var SECTIONS = core.SECTIONS, GROUPS = core.GROUPS;
  var channelInfo = core.channelInfo, channelLabel = core.channelLabel;
  var buildSummaryText = core.buildSummaryText, buildOneLiner = core.buildOneLiner;
  var excludedNames = core.excludedNames, languageNames = core.languageNames;
  var versionName = core.versionName, siteBase = core.siteBase;

  /* Microsoft's own page for the Office Deployment Tool */
  var ODT_EXE_PAGE = "https://www.microsoft.com/en-us/download/details.aspx?id=49117";


  function pickRow(options) {
    return '<label class="pick" data-note="' + escapeHtml(options.note || "") + '">' +
      '<input type="' + (options.type || "checkbox") + '" ' + options.data + '>' +
      '<svg class="icon sm" aria-hidden="true"><use href="#' + options.icon + '"></use></svg>' +
      '<span class="pick-name">' + escapeHtml(options.name) + "</span>" +
      (options.size ? '<span class="pick-size">' + escapeHtml(options.size) + "</span>" : "") + "</label>";
  }

  /* The Windows 98 dialog shows the highlighted row's description in its own
     pane; we do the same instead of describing every row inline. Edition and
     Version carry fixed text, so their panes are marked and never touched. */
  function renderPresets() {
    var html = ['<div class="preset-grid">'];
    ODT.presets.forEach(function (preset) {
      html.push('<button type="button" class="preset" data-preset="' + preset.id + '">' +
        '<span class="preset-name">' + escapeHtml(preset.name) + "</span>" +
        '<span class="preset-note">' + escapeHtml(preset.note) + "</span></button>");
    });
    html.push("</div>");
    return html.join("");
  }

  function renderEdition(current) {
    var archs = ODT.allowedArch(current);
    var arch = ODT.resolveArch(current);
    var only64 = archs.indexOf("32") === -1;
    var notes = {
      "64": only64 ? "The only choice on LTSC 2024." : "The default.",
      "32": only64 ? "Not available on LTSC 2024." : "Only for 32-bit add-ins."
    };
    var rows = ["64", "32"].map(function (bits) {
      var allowed = archs.indexOf(bits) !== -1;
      return '<label class="pick no-icon' + (allowed ? "" : " dim") + '" data-note="' + escapeHtml(notes[bits]) + '">' +
        '<input type="radio" name="arch" value="' + bits + '"' + (bits === arch ? " checked" : "") +
        (allowed ? "" : " disabled") + ">" +
        '<span class="pick-name">' + bits + "-bit</span>" +
        '<span class="pick-size">' + (bits === "64" ? "recommended" : "legacy add-ins") + "</span></label>";
    });

    return ['<div class="pick-columns short"><div>',
      '<div class="pick-list" role="group" aria-label="Office edition">' + rows.join("") + "</div>",
      "</div>",
      '<div class="pick-side"><div class="pick-desc"><h4>Description</h4>' +
      '<p id="edition-desc" data-fixed>Choose 64-bit unless you have a need for 32bit add-ins.</p>' +
      "</div></div></div>"
    ].join("");
  }

  function renderBuild(current) {
    /* three rows, so the short list height */
    var html = ['<div class="pick-columns short"><div>'];

    html.push('<div class="pick-list" role="radiogroup" aria-label="Build version">');
    html.push(pickRow({
      name: "Latest available",
      note: "Whatever Microsoft is publishing now.",
      icon: "i-ok-16",
      type: "radio",
      data: 'name="versionMode" value="latest"' + (state.versionMode === "latest" ? " checked" : "")
    }));
    html.push(pickRow({
      name: "A specific build",
      note: "One build everywhere, e.g. 16.0.17928.20156.",
      icon: "i-column-16",
      type: "radio",
      data: 'name="versionMode" value="build"' + (state.versionMode === "build" ? " checked" : "")
    }));
    html.push(pickRow({
      name: "Match what is already installed",
      note: "Install only; never with /download.",
      icon: "i-stylist-16",
      type: "radio",
      data: 'name="versionMode" value="installed"' + (state.versionMode === "installed" ? " checked" : "")
    }));
    html.push("</div>");
    html.push("</div>");

    html.push('<div class="pick-side"><div class="pick-desc"><h4>Description</h4><p id="build-desc">' +
      "Whatever Microsoft is publishing now.</p></div></div></div>");

    if (state.versionMode === "build") {
      html.push('<div class="inline-row"><label class="mini" for="version-input">Build number</label>' +
        '<input type="text" id="version-input" value="' + escapeHtml(state.version) + '" placeholder="' +
        escapeHtml(ODT.versionInfo.pattern) + '" aria-label="Build number" size="24">' +
        '<span class="mini">Find the current build in ' +
        '<a href="' + ODT.versionInfo.lookupUrl + '" target="_blank" rel="noopener">Microsoft\'s update history</a>.</span></div>');
    }
    if (state.versionMode === "installed") {
      html.push('<p class="tip">Only on a PC that already has Office, and never with ' +
        '<code>setup.exe /download</code>.</p>');
    }
    return html.join("");
  }

  function renderVersion(current) {
    var rows = [];

    GROUPS.forEach(function (group) {
      var products = ODT.products.filter(function (p) { return p.group === group.id; });
      if (!products.length) { return; }
      var productRows = products.map(function (product) {
        return pickRow({
          name: product.name,
          note: product.note,
          icon: (ODT.productInfo[product.id] || {}).icon || "i-box",
          data: 'data-product="' + product.id + '"' + (state.product === product.id ? " checked" : "")
        });
      });

      /* Other is the long tail of licences most people never need: a disclosure
         that stays shut so the list fits its box without a scrollbar. It opens
         if the chosen version lives in it, or if it was opened before. */
      if (group.id === "more") {
        var holdsChoice = products.some(function (p) { return p.id === state.product; });
        rows.push('<details class="pick-more"' + (view.otherOpen || holdsChoice ? " open" : "") + ">" +
          '<summary class="pick-group"><span class="more-mark" aria-hidden="true"></span>' +
          escapeHtml(group.label) + "</summary>" + productRows.join("") + "</details>");
        return;
      }

      rows.push('<div class="pick-group">' + escapeHtml(group.label) + "</div>");
      rows.push(productRows.join(""));
    });

    var html = ['<div class="pick-columns version"><div>'];
    html.push('<div class="pick-list" role="group" aria-label="Office version">' + rows.join("") + "</div>");
    html.push("</div>");

    html.push('<div class="pick-side"><div class="pick-desc"><h4>Description</h4>' +
      '<p id="version-desc" data-fixed>Pick a version and the channel, the apps and the rest follow from it.</p>' +
      "</div>");

    /* The channel is a short list, so it lives here as radios rather than in a
       dropdown: one per channel the chosen version allows. The block is always
       there and always the same height, so the section does not jump as the
       version changes; with nothing to offer it says so. No build numbers are
       shown -- see buildSummaryText. */
    var channels = ODT.allowedChannels(current);
    var channel = ODT.resolveChannel(current);
    html.push('<div class="pick-group">Update channel</div>');
    html.push('<div class="pick-list channel-list' + (channels.length ? "" : " is-idle") +
      '" role="radiogroup" aria-label="Update channel">');
    if (channels.length) {
      channels.forEach(function (id) {
        var info = channelInfo(id);
        html.push('<label class="pick no-icon" data-note="' + escapeHtml(info.note || "") + '">' +
          '<input type="radio" name="channel" value="' + id + '"' + (id === channel ? " checked" : "") +
          (channels.length === 1 ? " disabled" : "") + ">" +
          '<span class="pick-name">' + escapeHtml(channelLabel(id)) + "</span></label>");
      });
    } else {
      html.push('<label class="pick no-icon"><input type="radio" name="channel" disabled>' +
        '<span class="pick-name">' +
        (ODT.hasProduct(current) ? "No update channel for this version." : "Pick a version first.") +
        "</span></label>");
    }
    html.push("</div>");
    html.push("</div></div>");

    return html.join("");
  }

  function renderLanguages() {
    /* most common first, then everything else, each under its own caption */
    var languageById = {};
    ODT.languages.forEach(function (language) { languageById[language.id] = language; });
    var commonItems = ODT.commonLanguages.map(function (id) { return languageById[id]; }).filter(Boolean);
    var otherItems = ODT.languages.filter(function (language) {
      return ODT.commonLanguages.indexOf(language.id) === -1;
    });
    var items = commonItems.concat(otherItems);
    var groups = [
      { label: "Most common", first: 0, count: commonItems.length },
      { label: "All other languages", first: commonItems.length, count: otherItems.length }
    ];
    var rows = [];
    items.forEach(function (item, index) {
      var checked = state.languages.indexOf(item.id) !== -1;
      var group = groups.filter(function (candidate) { return candidate.first === index; })[0];
      if (group) {
        rows.push('<div class="pick-group">' + escapeHtml(group.label) + " (" + group.count + ")</div>");
      }
      /* No description per language: the name and its culture code are the whole
         story, and a sentence about each of 95 of them would be noise. */
      rows.push('<label class="pick">' +
        '<input type="checkbox" data-lang="' + item.id + '"' + (checked ? " checked" : "") + ">" +
        '<svg class="icon sm" aria-hidden="true"><use href="#i-spellcheck-16"></use></svg>' +
        '<span class="pick-name">' + escapeHtml(item.name) + "</span>" +
        '<span class="pick-size">' + escapeHtml(item.id) + "</span></label>");
    });

    var html = ['<div class="pick-columns"><div>'];
    html.push('<div class="pick-list" role="group" aria-label="Languages">' + rows.join("") + "</div>");
    html.push("</div>");

    /* The first picked language is the one Office shows its menus in; the rest
       are extra display languages. Choosing another from the drop-down moves it
       to the front, which is all "pick the UI language" means here. */
    var languageFor = function (id) { return languageById[id] || { name: id }; };
    var picked = state.languages.filter(function (id) { return id !== "MatchOS"; });
    var extra = picked.slice(1);

    html.push('<div class="pick-side">');
    html.push('<div class="pick-group">UI language</div>');
    html.push('<select id="ui-language" aria-label="UI language">');
    if (!picked.length) {
      /* nothing ticked at all, or only "same as Windows", which is not a UI
         language you can pick from a list of real ones */
      html.push('<option value="">' +
        (state.languages.length ? "Same as Windows" : "No language chosen") + "</option>");
    }
    picked.forEach(function (id, index) {
      html.push('<option value="' + escapeHtml(id) + '"' + (index === 0 ? " selected" : "") + ">" +
        escapeHtml(languageFor(id).name) + "</option>");
    });
    html.push("</select>");

    html.push('<div class="pick-group">Additional languages</div>');
    html.push('<div class="pick-list extra-list' + (extra.length ? "" : " is-idle") +
      '" role="list" aria-label="Additional languages">');
    if (extra.length) {
      /* listed, not ticked: the list above is where languages are chosen */
      extra.forEach(function (id) {
        html.push('<div class="pick plain">' +
          '<span class="pick-name">' + escapeHtml(languageFor(id).name) + "</span>" +
          '<span class="pick-size">' + escapeHtml(id) + "</span></div>");
      });
    } else {
      html.push('<div class="pick plain">' +
        '<span class="pick-name">Tick a language above to add it.</span></div>');
    }
    html.push("</div></div></div>");

    /* Every language Microsoft supports is in the list above, so there is no
       "other culture code" box to type into. */
    html.push('<label class="inline-row"><input type="checkbox" id="lang-matchos"' +
      (state.languages.indexOf("MatchOS") !== -1 ? " checked" : "") +
      "><span>Also match Windows (<code>MatchOS</code>), with <code>" +
      escapeHtml(state.matchOsFallback) + "</code> as fallback</span></label>");

    return html.join("");
  }

  /* The heading note follows the state, naming which list "Apps" is showing. */
  function appsNote(current) {
    var primary = ODT.primaryProduct(current);
    if (!primary) { return "Pick a version first."; }
    if (!primary.suite) { return "One app only; nothing to tick."; }
    return "Everything ticked; untick to exclude.";
  }

  function renderApps(current) {
    var primary = ODT.primaryProduct(current);
    var addons = primary ? (primary.addons || []) : [];
    var html = [];

    /* No version chosen: show the same twelve rows greyed out, so the section
       is the size it will be and nothing jumps when a version is picked. */
    if (!primary) {
      var idleRows = ODT.apps.map(function (entry) {
        return pickRow({
          name: entry.name,
          note: "Pick a version first.",
          icon: entry.icon || "i-doc",
          size: "ExcludeApp " + entry.id,
          /* the greyed list still shows what would be left out by default */
          data: 'data-app="' + entry.id + '"' +
            (state.excludeApps.indexOf(entry.id) === -1 ? " checked" : "") + " disabled"
        });
      });
      html.push('<div class="pick-columns apps"><div>');
      html.push('<div class="pick-list is-idle" role="group" aria-label="Apps">' + idleRows.join("") + "</div>");
      html.push("</div>");
      html.push('<div class="pick-side"><div class="pick-desc"><h4>Description</h4><p id="apps-desc">' +
        "Pick a version, then untick apps to exclude them.</p>");
      html.push('<p class="pick-tally" id="apps-left-out">' + (excludedNames().length
        ? "Excluding: " + escapeHtml(excludedNames().join(", ")) + "."
        : "Nothing is excluded.") + "</p>");
      html.push("</div></div></div>");
    } else if (primary.suite) {
      var rows = ODT.apps.map(function (entry) {
        var isIncluded = state.excludeApps.indexOf(entry.id) === -1;
        return pickRow({
          name: entry.name,
          note: entry.note,
          icon: entry.icon || "i-doc",
          size: "ExcludeApp " + entry.id,
          data: 'data-app="' + entry.id + '"' + (isIncluded ? " checked" : "")
        });
      });

      html.push('<div class="pick-columns apps"><div>');
      html.push('<div class="pick-list" role="group" aria-label="Apps">' + rows.join("") + "</div>");
      html.push("</div>");
      html.push('<div class="pick-side"><div class="pick-desc"><h4>Description</h4><p id="apps-desc">' +
        "Untick an app to exclude it.</p>");
      /* only the exclusion line survives: the count of ticked components said
         nothing the list did not already show */
      html.push('<p class="pick-tally" id="apps-left-out">' + (excludedNames().length
        ? "Excluding: " + escapeHtml(excludedNames().join(", ")) + "."
        : "Nothing is excluded.") + "</p>");
      html.push("</div></div></div>");
    } else {
      /* A version that installs one app and has no optional parts still shows
         the app list, with that app in it, so the section always reads as the
         app list. */
      var icon = (ODT.productInfo[primary.id] || {}).icon || "i-box";
      html.push('<div class="pick-columns short"><div>');
      html.push('<div class="pick-list" role="group" aria-label="Apps">' +
        '<label class="pick" data-note="' + escapeHtml(primary.note) + '">' +
        '<input type="checkbox" checked disabled>' +
        '<svg class="icon sm" aria-hidden="true"><use href="#' + icon + '"></use></svg>' +
        '<span class="pick-name">' + escapeHtml(primary.name) + "</span></label></div>");
      html.push("</div>");
      html.push('<div class="pick-side"><div class="pick-desc"><h4>Description</h4><p id="apps-desc">' +
        escapeHtml(primary.note) + "</p>");
      html.push('<p class="pick-tally" id="apps-left-out">' + (excludedNames().length
        ? "Excluding: " + escapeHtml(excludedNames().join(", ")) + "."
        : "Nothing is excluded.") + "</p>");
      html.push("</div></div></div>");
    }

    /* Visio and Project travel with the version you picked, so they belong here
       with the rest of the application choices. The block is always on screen,
       at the size two add-ons need, and refills as the version changes. */
    html.push('<div class="pick-group quiet">Add Additional Applications</div>');
    if (addons.length) {
      html.push('<div class="pick-list addon-list" role="group" aria-label="Add Additional Applications">');
      addons.forEach(function (id) {
        var addon = ODT.addonMap[id];
        var info = ODT.addonInfo[id] || {};
        html.push(pickRow({
          name: addon.name,
          note: "Needs its own licence.",
          icon: info.icon || "i-doc",
          data: 'data-addon="' + id + '"' + (state.addons.indexOf(id) !== -1 ? " checked" : "")
        }));
      });
      html.push("</div>");
    } else {
      html.push('<div class="pick-list addon-list is-idle" role="group" aria-label="Add Additional Applications">' +
        '<label class="pick no-icon"><input type="checkbox" disabled>' +
        '<span class="pick-name">' +
        (primary ? "No add-ons for this version." : "Pick a version first.") +
        "</span></label></div>");
    }

    return html.join("");
  }

  function renderOptions(current) {
    var html = [];

    html.push('<fieldset class="group"><ul class="check-list">');
    [
      ["removeMsi", "Uninstall older MSI-based Office first", "for Office 2016 or older"],
      ["removeExisting", "Remove MSI Office in every language", "otherwise only matching languages go"],
      ["keepUpdated", "Keep Office updated automatically", ""],
      ["sharedComputer", "Shared computer licensing", "Remote Desktop or multi-user PCs"],
      ["deviceBased", "Device-based licensing", "365 Apps only"],
      ["displayLevelFull", "Show the installer window", "untick to install silently"]
    ].forEach(function (row) {
      var key = row[0];
      var checked = key === "displayLevelFull" ? state.displayLevel === "Full" : !!state[key];
      /* the wider MSI removal is a sub-option of the plain one */
      var blocked = key === "removeExisting" && !state.removeMsi;
      html.push('<li><label' + (blocked ? ' class="dim"' : "") + '><input type="checkbox" data-opt="' + key + '"' +
        (checked ? " checked" : "") + (blocked ? " disabled" : "") + ">" +
        "<span>" + escapeHtml(row[1]) + (row[2] ? ' <span class="mini">&middot; ' + escapeHtml(row[2]) + "</span>" : "") + "</span></label></li>");
    });
    html.push("</ul></fieldset>");
    return html.join("");
  }

  function renderInstall(current) {
    var ready = ODT.hasProduct(current);
    var xml = ODT.buildXml(current);
    var oneLiner = ready ? buildOneLiner() : "";
    var warnings = ready ? ODT.dataWarnings(current) : [];
    var rows = ready ? ODT.summary(current) : [];

    var html = [];

    /* Nothing to build until a version is picked, but the section stays on
       screen: greyed like the idle app list, with the shape of what will appear,
       so the page never grows under the reader when a version is chosen. */
    if (warnings.length) {
      html.push('<ul class="warn-list">');
      warnings.forEach(function (warning) { html.push("<li>" + escapeHtml(warning) + "</li>"); });
      html.push("</ul>");
    }
    if (rows.length) {
      html.push('<table class="summary">');
      rows.forEach(function (row) {
        html.push("<tr><th>" + escapeHtml(row[0]) + "</th><td>" + escapeHtml(row[1]) + "</td></tr>");
      });
      html.push("</table>");
    }

    html.push('<div class="build-cards' + (ready ? "" : " is-idle") + '">');

    /* The express route: one line that does the lot. */
    html.push('<article class="build-card"><h3><svg class="icon md" aria-hidden="true"><use href="#i-copy-26"></use></svg>Automatic Install</h3>' +
      '<p class="mini">Runs the installer with exactly these settings.</p>' +
      '<div class="cmd-box"><code id="install-oneliner">' +
      (ready ? escapeHtml(oneLiner) : "Pick a version and this line appears here.") + "</code></div>" +
      '<div class="btn-row"><button type="button" class="btn primary" data-copy="#install-oneliner"' +
      (ready ? "" : " disabled") + '><svg class="icon sm" aria-hidden="true"><use href="#i-copy-16"></use></svg>Copy the line</button></div>' +
      "</article>");

    /* Everything you would do by hand, folded away. */
    html.push('<details class="manual">');
    html.push("<summary>Manual Install</summary>");

    html.push('<article class="build-card"><h3><svg class="icon md" aria-hidden="true"><use href="#i-save-26"></use></svg>configuration.xml</h3>' +
      '<div class="cmd-box xml-box"><code id="install-xml">' + escapeHtml(xml) + "</code></div>" +
      '<div class="btn-row">' +
      '<button type="button" class="btn" data-action="save-xml"' + (ready ? "" : " disabled") +
      '><svg class="icon sm" aria-hidden="true"><use href="#i-save-16"></use></svg>Save configuration.xml</button>' +
      '<button type="button" class="btn" data-copy="#install-xml"' + (ready ? "" : " disabled") +
      '><svg class="icon sm" aria-hidden="true"><use href="#i-copy-16"></use></svg>Copy XML</button>' +
      "</div></article>");

    html.push('<article class="build-card"><h3><svg class="icon md" aria-hidden="true"><use href="#i-open-26"></use></svg>Office Deployment Tool</h3>' +
      '<p class="mini">Microsoft\'s own setup.exe. Put <code>configuration.xml</code> beside it, then run:</p>' +
      '<div class="cmd-box"><code id="install-odt-commands">setup.exe /download configuration.xml' + "\n" +
      "setup.exe /configure configuration.xml</code></div>" +
      '<div class="btn-row">' +
      '<a class="btn" href="' + ODT_EXE_PAGE + '" target="_blank" rel="noopener">' +
      '<svg class="icon sm" aria-hidden="true"><use href="#i-open-16"></use></svg>Download the ODT from Microsoft</a>' +
      '<button type="button" class="btn" data-copy="#install-odt-commands"' + (ready ? "" : " disabled") +
      '><svg class="icon sm" aria-hidden="true"><use href="#i-copy-16"></use></svg>Copy the two commands</button>' +
      "</div></article>");

    html.push("</details>");
    html.push("</div>");
    return html.join("");
  }
  SETUP.sections = {
    presets: renderPresets,
    edition: renderEdition,
    version: renderVersion,
    build: renderBuild,
    apps: renderApps,
    languages: renderLanguages,
    options: renderOptions,
    install: renderInstall,
    /* the rail's status bar reuses this line */
    appsNote: appsNote
  };
})();
