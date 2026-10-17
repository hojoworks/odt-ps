/* Pure logic for the setup wizard: state normalisation, configuration.xml
 * generation, summary rows and the equivalent command line.
 * No DOM access here, so it can be tested with node (tools/check-wizard.mjs).
 */
window.ODT = window.ODT || {};

(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* "  <Add A="1" B="2">" with a continuation indent when it gets long. */
  function openTag(name, attributes, indent, selfClosing) {
    var pad = new Array(indent * 2 + 1).join(' ');
    var close = selfClosing ? ' />' : '>';
    if (!attributes.length) { return pad + '<' + name + close; }

    var lines = [pad + '<' + name + ' ' + attributes[0]];
    var contPad = pad + '     ';
    for (var i = 1; i < attributes.length; i++) {
      var candidate = lines[lines.length - 1] + ' ' + attributes[i];
      if (candidate.length <= 92) { lines[lines.length - 1] = candidate; }
      else { lines.push(contPad + attributes[i]); }
    }
    lines[lines.length - 1] += close;
    return lines.join('\n');
  }

  /* Nothing is selected until a version is picked: the page then shows what it
     can (the lists) and greys out what it cannot offer yet. */
  ODT.primaryProduct = function (state) {
    return ODT.productMap[state.product] || null;
  };

  ODT.hasProduct = function (state) {
    return ODT.primaryProduct(state) !== null;
  };

  ODT.family = function (state) {
    var product = ODT.primaryProduct(state);
    return product ? product.family : null;
  };

  /* Add-ons are only valid when the chosen product offers them. */
  ODT.addonList = function (state) {
    var product = ODT.primaryProduct(state);
    var allowed = product ? (product.addons || []) : [];
    return (state.addons || []).filter(function (id) {
      return allowed.indexOf(id) !== -1 && ODT.addonMap[id];
    });
  };

  ODT.allowedChannels = function (state) {
    var family = ODT.families[ODT.family(state)];
    return family ? family.channels.slice() : [];
  };

  ODT.allowedArch = function (state) {
    var family = ODT.families[ODT.family(state)];
    /* with no version chosen both editions are still on the table */
    return family ? family.arch.slice() : ["64", "32"];
  };

  ODT.resolveChannel = function (state) {
    var allowed = ODT.allowedChannels(state);
    if (state.channel && allowed.indexOf(state.channel) !== -1) { return state.channel; }
    var family = ODT.families[ODT.family(state)];
    return family ? family.defaultChannel : "";
  };

  ODT.resolveArch = function (state) {
    var allowed = ODT.allowedArch(state);
    if (state.arch && allowed.indexOf(state.arch) !== -1) { return state.arch; }
    return '64';
  };

  /* Drops add-ons a product cannot use and clamps channel/architecture.
     A shallow copy is enough: every field that needs filtering is replaced
     with a new array, so the caller's state is never mutated. */
  ODT.normalize = function (state) {
    var copy = {};
    Object.keys(state).forEach(function (key) { copy[key] = state[key]; });
    copy.addons = ODT.addonList(state);
    copy.channel = ODT.resolveChannel(state);
    copy.arch = ODT.resolveArch(state);
    copy.languages = (state.languages && state.languages.length) ? state.languages.slice() : ['en-us'];
    copy.excludeApps = (state.excludeApps || []).filter(function (id) { return ODT.appMap[id]; });
    copy.displayLevel = state.displayLevel === 'Full' ? 'Full' : 'None';
    copy.version = state.matchInstalled ? 'MatchInstalled' : String(state.version || '').trim();
    return copy;
  };

  ODT.buildXml = function (input) {
    var state = ODT.normalize(input);
    if (!ODT.hasProduct(state)) {
      return "<!-- pick a version first: configuration.xml is built from it -->";
    }
    var products = [ODT.primaryProduct(state)].concat(state.addons.map(function (id) { return ODT.addonMap[id]; }));

    var lines = ['<Configuration>'];

    var addAttributes = [];
    if (state.sourcePath) { addAttributes.push('SourcePath="' + escapeHtml(state.sourcePath) + '"'); }
    addAttributes.push('OfficeClientEdition="' + state.arch + '"');
    addAttributes.push('Channel="' + state.channel + '"');
    if (state.version) { addAttributes.push('Version="' + escapeHtml(state.version) + '"'); }
    lines.push(openTag('Add', addAttributes, 1));

    products.forEach(function (product) {
      var children = [];
      state.languages.forEach(function (id) {
        var attributes = ['ID="' + escapeHtml(id) + '"'];
        if (id === 'MatchOS' && state.matchOsFallback) {
          attributes.push('Fallback="' + escapeHtml(state.matchOsFallback) + '"');
        }
        children.push(openTag('Language', attributes, 3, true));
      });
      if (product.suite) {
        state.excludeApps.forEach(function (appId) {
          children.push(openTag('ExcludeApp', ['ID="' + escapeHtml(appId) + '"'], 3, true));
        });
      }
      if (children.length) {
        lines.push(openTag('Product', ['ID="' + escapeHtml(product.id) + '"'], 2));
        Array.prototype.push.apply(lines, children);
        lines.push('    </Product>');
      } else {
        lines.push(openTag('Product', ['ID="' + escapeHtml(product.id) + '"'], 2, true));
      }
    });

    lines.push('  </Add>');

    /* <Remove> is only valid inside <RemoveMSI>: on its own the file is rejected.
       Without it, <RemoveMSI /> takes out the MSI installs that share a language
       with what we are installing; All="TRUE" takes out every language. */
    if (state.removeMsi || state.removeExisting) {
      if (state.removeExisting) {
        lines.push('  <RemoveMSI>');
        lines.push('    <Remove All="TRUE" />');
        lines.push('  </RemoveMSI>');
      } else {
        lines.push('  <RemoveMSI />');
      }
    }
    lines.push('  <Updates Enabled="' + (state.keepUpdated ? 'TRUE' : 'FALSE') + '" />');
    lines.push('  <Display Level="' + state.displayLevel + '" AcceptEULA="' + (state.acceptEula ? 'TRUE' : 'FALSE') + '" />');
    lines.push('  <Property Name="FORCEAPPSHUTDOWN" Value="' + (state.forceAppShutdown ? 'TRUE' : 'FALSE') + '" />');
    if (state.sharedComputer) { lines.push('  <Property Name="SharedComputerLicensing" Value="1" />'); }
    if (state.deviceBased) { lines.push('  <Property Name="DeviceBasedLicensing" Value="1" />'); }

    lines.push('</Configuration>');
    return lines.join('\n');
  };

  /* The same selections as a get.ps1 command line. */
    /* The same selections as a get.ps1 command line, ending in whichever way the
     run does: a download and install, or just the XML. Both are the same words up
     to the end, so the shared part is built once. */
  ODT.commandLine = function (input, ending) {
    var state = ODT.normalize(input);
    if (!ODT.hasProduct(state)) { return ''; }
    var parts = ['.\\get.ps1'];
    parts.push('-Product ' + [state.product].concat(state.addons).join(','));
    parts.push('-Languages ' + state.languages.join(','));
    if (state.arch !== '64') { parts.push('-Arch ' + state.arch); }
    var defaultChannel = ODT.families[ODT.family(state)].defaultChannel;
    if (state.channel !== defaultChannel) { parts.push('-Channel ' + state.channel); }
    if (state.version) { parts.push('-Version ' + state.version); }
    if (state.excludeApps.length) { parts.push('-Exclude ' + state.excludeApps.join(',')); }
    if (state.displayLevel === 'Full') { parts.push('-ShowWindow'); }
    if (state.keepFiles) { parts.push('-KeepFiles'); }
    return parts.concat(ending).join(' ');
  };

  ODT.buildCommand = function (input) {
    return ODT.commandLine(input, ['-Download', '-Install', '-Silent']);
  };

  ODT.summary = function (input) {
    var state = ODT.normalize(input);
    var primary = ODT.primaryProduct(state);
    if (!primary) { return []; }
    var rows = [];

    rows.push(['Version', primary.name + '  (' + primary.id + ')']);
    rows.push(['Also installing', state.addons.length
      ? state.addons.map(function (id) { return ODT.addonMap[id].name; }).join(', ')
      : 'nothing else']);
    rows.push(['Channel', ODT.channelNames[state.channel]]);
    rows.push(['Build', state.version === 'MatchInstalled'
      ? 'match installed (MatchInstalled)'
      : (state.version || 'latest available on the channel')]);
    rows.push(['Edition', state.arch + '-bit' + (state.arch === '32' ? '  (legacy add-ins)' : '')]);
    rows.push(['Languages', state.languages.map(function (id) {
      return ODT.languageMap[id] ? ODT.languageMap[id].name : id;
    }).join(', ')]);
    rows.push(['Excluding', state.excludeApps.length
      ? state.excludeApps.map(function (id) { return ODT.appMap[id].name; }).join(', ')
      : 'nothing']);

    var options = [];
    if (state.removeMsi) { options.push('uninstall older MSI Office first'); }
    if (state.removeExisting) { options.push('that MSI removal covers every language'); }
    if (state.sharedComputer) { options.push('shared computer licensing'); }
    if (state.deviceBased) { options.push('device-based licensing'); }
    if (!state.keepUpdated) { options.push('updates disabled'); }
    if (state.displayLevel === 'Full') { options.push('show the install dialog'); }
    if (state.keepFiles) { options.push('keep the downloaded files'); }
    rows.push(['Options', options.length ? options.join('; ') : 'defaults']);

    return rows;
  };

  ODT.dataWarnings = function (input) {
    var state = ODT.normalize(input);
    var warnings = [];
    if (!ODT.hasProduct(state)) { return warnings; }
    var family = ODT.family(state);

    if (family === 'ltsc2024' && input.arch === '32') {
      warnings.push('LTSC 2024 is 64-bit only; the 32-bit choice was ignored.');
    }
    if (state.languages.indexOf('MatchOS') !== -1 && !state.matchOsFallback) {
      warnings.push('“Same as Windows” needs a fallback language pack.');
    }
    if (!input.languages || !input.languages.length) {
      warnings.push('No language chosen; English (United States) will be used.');
    }
    if (family !== 'm365' && state.addons.length === 0 && (input.addons || []).length > 0) {
      warnings.push('Visio/Project dropped: they do not match this product.');
    }
    if (state.version === 'MatchInstalled') {
      warnings.push('MatchInstalled needs Office already installed, and never works with setup.exe /download.');
    }
    if (state.version && state.version !== 'MatchInstalled' && !/^16\.0\.\d+\.\d+$/.test(state.version)) {
      warnings.push('Not shaped like 16.0.XXXXX.YYYYY; Microsoft will reject it.');
    }
    return warnings;
  };
})();
