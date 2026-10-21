/* The classic Select Components panel: rows, icons, panes, tallies, the Other
   disclosure, the channel block and the add-on block. */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function run(ctx) {
  const { client, check, evaluate, wait, waitFor, pickVersion, XML_IS_CONSISTENT } = ctx;
  /* ---- the classic pick lists ---- */
  const pickLists = await evaluate(client,
    "(function () {" +
    "  function anatomy(sel) {" +
    "    var list = document.querySelector(sel + ' .pick-list');" +
    "    var first = list.querySelector('.pick');" +
    "    var cs = getComputedStyle(list);" +
    "    return { rows: list.querySelectorAll('.pick').length," +
    "             groups: list.querySelectorAll('.pick-group').length," +
    "             white: cs.backgroundColor === 'rgb(255, 255, 255)' && cs.borderTopWidth !== '0px'," +
    "             scrolls: list.scrollHeight > list.clientHeight + 1," +
    "             rowHeight: first.getBoundingClientRect().height," +
    "             icon: first.querySelector('.icon').getBoundingClientRect().width," +
    "             size: (first.querySelector('.pick-size') || {}).textContent || ''," +
    "             tally: (document.querySelector(sel + ' .pick-tally') || {}).textContent || ''" +
    "           };" +
    "  }" +
    "  var edition = document.getElementById('edition-body');" +
    "  var versionBody = document.getElementById('version-body');" +
    "  var buildBody = document.getElementById('build-body');" +
    "  var appsBody = document.getElementById('apps-body');" +
    "  var channelRadios = versionBody.querySelectorAll('.pick-side input[name=channel]');" +
    "  return {" +
    "    version: anatomy('#version-body'), apps: anatomy('#apps-body')," +
    "    editionChoices: edition.querySelectorAll('input[name=arch]').length," +
    "    editionDefault: (edition.querySelector('input[name=arch]:checked') || {}).value," +
    "    editionHasBuild: edition.querySelectorAll('input[name=versionMode]').length," +
    "    buildChoices: buildBody.querySelectorAll('input[name=versionMode]').length," +
    "    buildRadios: buildBody.querySelectorAll('input[name=versionMode][type=radio]').length," +
    "    buildTicked: buildBody.querySelectorAll('input[name=versionMode]:checked').length," +
    "    buildPane: !!buildBody.querySelector('.pick-desc p')," +
    "    legendsBold: Array.prototype.every.call(document.querySelectorAll('legend'), function (l) { return getComputedStyle(l).fontWeight === '700'; })," +
    "    addonsInApps: (function () {" +
    "      var captions = appsBody.querySelectorAll('.pick-group');" +
    "      var named = Array.prototype.some.call(captions, function (c) { return c.textContent === 'Add Additional Applications'; });" +
    "      return named ? appsBody.querySelectorAll('input[data-addon]').length : 0;" +
    "    })()," +
    "    addonListHeight: Math.round(appsBody.querySelector('.addon-list').getBoundingClientRect().height)," +
    "    addonListStyled: (function () {" +
    "      var list = appsBody.querySelector('.addon-list');" +
    "      return !!list && getComputedStyle(list).backgroundColor === 'rgb(255, 255, 255)' &&" +
    "             appsBody.querySelectorAll('fieldset').length === 0;" +
    "    })()," +
    "    more: (function () {" +
    "      var more = versionBody.querySelector('.pick-more');" +
    "      return { present: !!more, open: !!(more && more.open)," +
    "               rows: more ? more.querySelectorAll('.pick').length : 0," +
    "               label: more ? more.querySelector('summary').textContent.trim() : '' };" +
    "    })()," +
    "    pane: !!versionBody.querySelector('.pick-desc p')," +
    "    channels: Array.prototype.map.call(channelRadios, function (r) { return r.value; }).join(',')," +
    "    channelHeight: Math.round(channelRadios[0].closest('.pick-list').getBoundingClientRect().height)," +
    "    channelBuilds: (versionBody.textContent.match(/\\d{5}\\.\\d{5}/g) || []).length," +
    "    ticked: versionBody.querySelectorAll('input[data-product]:checked').length" +
    "  };" +
    "})()");
  check("version list is a white panel of compact single-line rows with 16 px icons",
    pickLists.version.white && pickLists.version.rows >= 8 && pickLists.version.groups >= 2 &&
    pickLists.version.rowHeight <= 24 && pickLists.version.icon === 16, JSON.stringify(pickLists.version));
  /* Other is the long tail: shut, it costs one caption, so the list fits its box
     with no scrollbar; opening it adds its rows and the list scrolls instead. */
  const more = await evaluate(client,
    "(function () {" +
    "  var list = document.querySelector('#version-body .pick-list');" +
    "  var more = document.querySelector('#version-body .pick-more');" +
    "  function snap() {" +
    "    return { open: more.open, box: Math.round(list.getBoundingClientRect().height)," +
    "             scrolls: list.scrollHeight > list.clientHeight + 1 };" +
    "  }" +
    "  list.scrollTop = 0;" +
    "  var shut = snap();" +
    "  more.querySelector('summary').click();" +
    "  var opened = snap();" +
    "  var rowsShown = more.querySelectorAll('.pick').length;" +
    "  more.querySelector('summary').click();" +
    "  return { shut: shut, opened: opened, rowsShown: rowsShown, back: snap() };" +
    "})()");
  check("Other is a shut disclosure that fits the box, and opens to the rest of the list",
    more.shut.open === false && more.shut.scrolls === false &&
    more.rowsShown === 4 && more.opened.open === true && more.opened.scrolls === true &&
    more.opened.box === more.shut.box && more.back.open === false,
    JSON.stringify(more));
  check("app list is compact with icons and a tally, and all twelve rows fit",
    pickLists.apps.rows === 12 && pickLists.apps.rowHeight <= 24 && pickLists.apps.icon === 16 &&
    pickLists.apps.scrolls === false &&
    pickLists.apps.tally === "Nothing is excluded." &&
  pickLists.apps.size === "", JSON.stringify(pickLists.apps));
  check("edition holds only the edition, and the build is its own section of radios",
    pickLists.editionChoices === 2 && pickLists.editionDefault === "64" &&
    pickLists.editionHasBuild === 0 && pickLists.buildChoices === 3 &&
    pickLists.buildRadios === 3 && pickLists.buildTicked === 1 && pickLists.buildPane === true &&
    pickLists.legendsBold === true, JSON.stringify(pickLists));
  /* Hovering a build shows its description; leaving the list puts back the one
     belonging to the build that is ticked. */
  const paneBack = await evaluate(client,
    "(function () {" +
    "  var section = document.getElementById('s-build');" +
    "  var pane = section.querySelector('.pick-desc p');" +
    "  var rows = Array.prototype.slice.call(section.querySelectorAll('.pick'));" +
    "  var checked = section.querySelector('.pick input:checked');" +
    "  var chosen = checked ? checked.closest('.pick').getAttribute('data-note') : null;" +
    "  var other = rows.filter(function (row) {" +
    "    return !row.querySelector('input').checked; }) [0];" +
    "  other.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));" +
    "  var hovered = pane.textContent;" +
    "  other.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: section }));" +
    "  return { chosen: chosen, other: other.getAttribute('data-note'), hovered: hovered," +
    "           restored: pane.textContent };" +
    "})()");
  check("a description pane returns to the ticked row when the pointer leaves",
    paneBack.hovered === paneBack.other && paneBack.restored === paneBack.chosen &&
    paneBack.other !== paneBack.chosen, JSON.stringify(paneBack));

  check("Add Additional Applications is its own block in Apps, styled like the app list",
    pickLists.addonsInApps === 2 && pickLists.addonListStyled === true &&
    pickLists.addonListHeight === 50,
    JSON.stringify({ addonsInApps: pickLists.addonsInApps, addonListStyled: pickLists.addonListStyled,
      addonListHeight: pickLists.addonListHeight }));

  /* A rebuild must not send a scrolled list back to the top: ticking a language
     deep in the 95-row list used to do exactly that. */
  await evaluate(client, "window.SETUP.api.reset()");
  await wait(200);
  const keepsPlace = await evaluate(client,
    "(function () {" +
    "  var list = document.querySelector('#languages-body .pick-list');" +
    "  list.scrollTop = 400;" +
    "  var before = list.scrollTop;" +
    "  list.querySelectorAll('.pick')[20].click();" +
    "  var after = document.querySelector('#languages-body .pick-list').scrollTop;" +
    "  return { before: before, after: after, ticked: window.SETUP.api.state().languages.length };" +
    "})()");
  check("a rebuild keeps a scrolled list where it was",
    keepsPlace.before > 0 && keepsPlace.after === keepsPlace.before && keepsPlace.ticked === 1,
    JSON.stringify(keepsPlace));

  /* Languages: no descriptions, no tally, and the first one ticked is the UI
     language -- the drop-down is how you move that choice. */
  await evaluate(client, "window.SETUP.api.reset()");
  await wait(200);
  const languages = await evaluate(client,
    "(function () {" +
    "  var body = document.getElementById('languages-body');" +
    "  function snap() {" +
    "    var select = body.querySelector('#ui-language');" +
    "    function name(row) { return (row.querySelector('.pick-name') || {}).textContent || ''; }" +
    "    return { chosen: select.value," +
    "             placeholder: (select.options[0] || {}).text," +
    "             options: Array.prototype.map.call(select.options, function (o) { return o.value; }).join(',')," +
    "             extra: Array.prototype.map.call(body.querySelectorAll('.extra-list .pick'), name).join(',')," +
    "             extraInputs: body.querySelectorAll('.extra-list input').length," +
    "             notes: body.querySelectorAll('.pick[data-note]').length," +
    "             tallies: body.querySelectorAll('.pick-tally').length," +
    "             state: window.SETUP.api.state().languages.join(',') };" +
    "  }" +
    "  var empty = snap();" +
    "  body.querySelector('input[data-lang=\"de-de\"]').click();" +
    "  body.querySelector('input[data-lang=\"en-us\"]').click();" +
    "  var two = snap();" +
    "  var select = body.querySelector('#ui-language');" +
    "  select.value = 'en-us';" +
    "  select.dispatchEvent(new Event('change', { bubbles: true }));" +
    "  return { empty: empty, two: two, swapped: snap() };" +
    "})()");
  await pickVersion("O365ProPlusRetail");
  const languageOrder = await evaluate(client,
    "(function () {" +
    "  var xml = document.getElementById('install-xml').textContent;" +
    "  return (xml.match(/Language ID=\"([a-z-]+)\"/g) || []).join(' ');" +
    "})()");
  /* only "same as Windows" ticked: there is no UI language to choose from */
  const matchOnly = await evaluate(client,
    "(function () {" +
    "  var body = document.getElementById('languages-body');" +
    "  body.querySelector('input[data-lang=\"de-de\"]').click();" +
    "  body.querySelector('input[data-lang=\"en-us\"]').click();" +
    "  body.querySelector('#lang-matchos').click();" +
    "  var select = body.querySelector('#ui-language');" +
    "  return { chosen: select.value, placeholder: (select.options[0] || {}).text," +
    "           state: window.SETUP.api.state().languages.join(',') };" +
    "})()");
  /* report only the part that is wrong, so the failure is readable */
  const wanted = {
    "empty: nothing chosen": languages.empty.chosen === "" && languages.empty.state === "",
    "empty: placeholder shown": languages.empty.extra.indexOf("Tick a language") !== -1,
    "empty: no per-language notes": languages.empty.notes === 0,
    "empty: no tally": languages.empty.tallies === 0,
    "empty: no controls in the extra list": languages.empty.extraInputs === 0,
    "two: ticked order": languages.two.options === "de-de,en-us" && languages.two.state === "de-de,en-us",
    "two: the extra one listed": languages.two.extra.indexOf("English") !== -1,
    "two: the extra list is read-only": languages.two.extraInputs === 0,
    "swapped: front of the list": languages.swapped.chosen === "en-us" &&
      languages.swapped.state === "en-us,de-de",
    "swapped: extra one listed": languages.swapped.extra.indexOf("German") !== -1,
    "matchos only: the drop-down says so": matchOnly.chosen === "" &&
      matchOnly.placeholder === "Same as Windows" && matchOnly.state === "MatchOS",
    "xml: follows the order": languageOrder.indexOf("en-us") !== -1 &&
      languageOrder.indexOf("en-us") < languageOrder.indexOf("de-de")
  };
  const languageFaults = Object.keys(wanted).filter((key) => !wanted[key]);
  check("Languages starts empty, and the drop-down decides which pick is the UI language",
    languageFaults.length === 0,
    JSON.stringify({ faults: languageFaults, languages: languages, order: languageOrder,
      matchOnly: matchOnly }));

  /* Controls: the check and the dot are the browser's own now, tinted with the
     page accent, so there is no hand-drawn box to keep visible; the scrollbar
     thumb still has to be chiselled. */
  const controls = await evaluate(client,
    "(function () {" +
    "  var box = document.querySelector('#apps-body input[type=checkbox]');" +
    "  var radio = document.querySelector('#edition-body input[type=radio]');" +
    "  var b = getComputedStyle(box), r = getComputedStyle(radio);" +
    "  var thumb = getComputedStyle(document.querySelector('.setup-content'), '::-webkit-scrollbar-thumb');" +
    "  return { boxNative: b.appearance !== 'none' && b.backgroundImage === 'none'," +
    "           radioNative: r.appearance !== 'none' && r.backgroundImage === 'none'," +
    "           accent: b.accentColor, radioAccent: r.accentColor," +
    "           thumbImage: thumb.backgroundImage.indexOf('linear-gradient') !== -1 };" +
    "})()");
  check("check boxes and radio dots are the browser's own, in the page navy, scrollbar thumbs chiselled",
    controls.boxNative && controls.radioNative && controls.accent === "rgb(0, 0, 128)" &&
    controls.radioAccent === "rgb(0, 0, 128)" && controls.thumbImage === true,
    JSON.stringify(controls));

  /* The Apps section is always there, and it always shows a list: a version
     that installs only itself gets that one app as its only row. */
  const singleApp = await evaluate(client,
    "(function () {" +
    "  var box = document.querySelector('#version-body input[data-product=\"AccessRuntimeRetail\"]');" +
    "  box.checked = true;" +
    "  box.dispatchEvent(new Event('change', { bubbles: true }));" +
    "  var section = document.getElementById('s-apps');" +
    "  var list = document.querySelector('#apps-body .pick-list');" +
    "  return { hidden: section.hidden, display: getComputedStyle(section).display," +
    "           rows: list ? list.querySelectorAll('.pick').length : 0," +
    "           name: list ? list.querySelector('.pick-name').textContent : ''," +
    "           ticked: list ? list.querySelectorAll('input:checked').length : 0," +
    "           pane: (document.querySelector('#apps-body .pick-desc p') || {}).textContent || ''," +
    "           rail: Array.prototype.map.call(document.querySelectorAll('#rail-steps li [data-section]'), function (a) { return a.textContent; }).join(',')," +
    "           addonNote: (document.querySelector('#apps-body .addon-list .pick-name') || {}).textContent || ''," +
    "           rowHeight: list ? list.querySelector('.pick').getBoundingClientRect().height : 0 };" +
    "})()");
  check("a single-app version still shows the Apps list, with that app in it",
    singleApp.display !== "none" && singleApp.rows === 1 &&
    singleApp.name === "Microsoft Access Runtime" && singleApp.ticked === 1 &&
    singleApp.pane.length > 10 &&
    singleApp.rail.indexOf("Add / Remove Applications") !== -1 &&
    singleApp.addonNote === "No add-ons for this version.",
    JSON.stringify(singleApp));

  await evaluate(client, "window.SETUP.api.reset()");
  await wait(200);
  await pickVersion("O365ProPlusRetail");
  const restored = await evaluate(client,
    "(function () {" +
    "  var list = document.querySelector('#apps-body .pick-list');" +
    "  return { hidden: document.getElementById('s-apps').hidden," +
    "           rows: list ? list.querySelectorAll('.pick').length : 0," +
    "           addons: document.querySelectorAll('#apps-body input[data-addon]').length };" +
    "})()");
  check("picking a suite version brings back the full app list and the add-ons",
    restored.hidden === false && restored.rows === 12 && restored.addons === 2, JSON.stringify(restored));
  check("update channel is a radio list in the description column, with no build numbers",
    pickLists.pane && pickLists.channels === "Current,MonthlyEnterprise,SemiAnnual" &&
    pickLists.channelHeight === 72 && pickLists.channelBuilds === 0, JSON.stringify(pickLists));
  check("exactly one version is ticked", pickLists.ticked === 1, JSON.stringify(pickLists));

  const description = await evaluate(client,
    "(function () {" +
    "  var wrap = document.querySelector('#apps-body .pick-columns');" +
    "  var pane = wrap.querySelector('.pick-desc p');" +
    "  var before = pane.textContent.trim();" +
    "  var row = wrap.querySelectorAll('.pick')[1];" +
    "  row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));" +
    "  return { changed: pane.textContent.trim() !== before, matches: pane.textContent.trim() === row.getAttribute('data-note').trim() };" +
    "})()");
  check("hovering a row fills the description pane", description.changed && description.matches,
    JSON.stringify(description));

  /* Edition and Version are the two panes that carry fixed text instead. */
  const fixedPanes = await evaluate(client,
    "(function () {" +
    "  var out = {};" +
    "  ['edition', 'version'].forEach(function (id) {" +
    "    var wrap = document.querySelector('#' + id + '-body .pick-columns');" +
    "    var pane = wrap.querySelector('.pick-desc p');" +
    "    var before = pane.textContent.trim();" +
    "    wrap.querySelectorAll('.pick')[0].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));" +
    "    out[id] = { text: before, kept: pane.textContent.trim() === before };" +
    "  });" +
    "  return out;" +
    "})()");
  check("the Edition and Version descriptions are fixed text",
    fixedPanes.edition.text === "Choose 64-bit unless you have a need for 32bit add-ins." &&
    fixedPanes.edition.kept === true &&
    fixedPanes.version.text === "Pick a version and the channel, the apps and the rest follow from it." &&
    fixedPanes.version.kept === true, JSON.stringify(fixedPanes));

  /* A hovered row is navy, so its checkbox has to invert: dark-on-white would
     vanish, and a white tick on a white box is exactly the bug this pins. */
  await evaluate(client,
    "(function () {" +
    "  var row = document.querySelectorAll('#version-body .pick-list .pick')[0];" +
    "  document.getElementById('s-version').scrollIntoView();" +
    "  row.scrollIntoView({ block: 'center' });" +
    "})()");
  await wait(300);
  /* Hover the middle of the part of the row that is actually on screen, the way
     a pointer would: a clipped row has no hoverable point. */
  const hoverPoint = await evaluate(client,
    "(function () {" +
    "  var row = document.querySelectorAll('#version-body .pick-list .pick')[0];" +
    "  var r = row.getBoundingClientRect();" +
    "  var box = document.querySelector('.setup-content').getBoundingClientRect();" +
    "  var top = Math.max(r.top, box.top), bottom = Math.min(r.bottom, box.bottom);" +
    "  var left = Math.max(r.left, box.left), right = Math.min(r.right, box.right);" +
    "  var visible = bottom - top >= 4 && right - left >= 4;" +
    "  var input = row.querySelector('input');" +
    "  var cs = getComputedStyle(input);" +
    "  return { x: Math.round((left + right) / 2), y: Math.round((top + bottom) / 2)," +
    "           visible: visible, ticked: input.checked," +
    "           restingAppearance: cs.appearance, restingAccent: cs.accentColor };" +
    "})()");
  const hover = { on: false };
  for (let attempt = 0; attempt < 3 && hover.on !== true; attempt++) {
    await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2, button: "none" });
    await wait(60);
    await client.send("Input.dispatchMouseEvent",
      { type: "mouseMoved", x: hoverPoint.x, y: hoverPoint.y, button: "none" });
    await wait(150);
    Object.assign(hover, await evaluate(client,
      "(function () {" +
      "  var row = document.querySelectorAll('#version-body .pick-list .pick')[0];" +
      "  var input = row.querySelector('input');" +
      "  var cs = getComputedStyle(input);" +
      "  var r = input.getBoundingClientRect();" +
      "  return { on: row.matches(':hover'), rowBg: getComputedStyle(row).backgroundColor," +
      "           appearance: cs.appearance, accent: cs.accentColor, w: r.width, h: r.height };" +
      "})()"));
  }
  /* The browser paints the native box, so the navy highlight cannot swallow it;
     it only has to still be there, tinted with the page accent. */
  check("a hovered row keeps its native check box over the navy highlight",
    hoverPoint.visible === true && hoverPoint.ticked === true && hover.on === true &&
    hoverPoint.restingAppearance !== "none" && hoverPoint.restingAccent === "rgb(0, 0, 128)" &&
    hover.rowBg === "rgb(0, 0, 128)" && hover.appearance !== "none" &&
    hover.accent === "rgb(0, 0, 128)" && hover.w > 0 && hover.h > 0,
    JSON.stringify({ point: hoverPoint, hover: hover }));

  /* Park the pointer away from the window again, so later checks see resting
     styles rather than hover states. */
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2, button: "none" });
  await wait(150);

  /* The section cache is an optimisation with a contract: a change must only
     rebuild the sections it affects. */
  const caching = await evaluate(client,
    "(function () {" +
    "  var languagesBefore = document.querySelector('#languages-body .pick-list');" +
    "  var appsBefore = document.querySelector('#apps-body .pick-list');" +
    "  var option = document.querySelector('#options-body input[data-opt=\"removeMsi\"]');" +
    "  option.checked = !option.checked;" +
    "  option.dispatchEvent(new Event('change', { bubbles: true }));" +
    "  return { languagesKept: languagesBefore === document.querySelector('#languages-body .pick-list')," +
    "           appsKept: appsBefore === document.querySelector('#apps-body .pick-list') };" +
    "})()");
  check("a change rebuilds only the sections it affects",
    caching.languagesKept === true && caching.appsKept === true, JSON.stringify(caching));

  /* ---- retro scrollbars ----
     `getComputedStyle(el, '::-webkit-scrollbar')` reports the rule even when the
     browser has decided not to draw it, so the drawn width is measured from the
     layout gutter as well. */
  const scrollbar = await evaluate(client,
    "(function () {" +
    "  var list = document.querySelector('#version-body .pick-list');" +
    "  function style(sel) { return getComputedStyle(list, sel); }" +
    "  var cs = getComputedStyle(list);" +
    "  var borders = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);" +
    "  return { scrolls: list.scrollHeight > list.clientHeight + 1," +
    "           width: style('::-webkit-scrollbar').width," +
    "           drawn: Math.round(list.offsetWidth - list.clientWidth - borders)," +
    "           standard: cs.scrollbarColor," +
    "           thumb: style('::-webkit-scrollbar-thumb').backgroundColor," +
    "           track: style('::-webkit-scrollbar-track').backgroundImage };" +
    "})()");
  const siteCss = process.env.SETUP_URL
    ? await (await fetch(new URL("scrollbars.css", process.env.SETUP_URL).href)).text()
    : readFileSync(join(root, "site", "scrollbars.css"), "utf8");
  check("scrollbar is a 16 px retro bar: palette-grey thumb, dithered track, arrow rules",
    scrollbar.scrolls && scrollbar.width === "16px" && scrollbar.drawn === 16 &&
    scrollbar.standard === "auto" &&
    scrollbar.thumb === "rgb(192, 192, 192)" &&
    scrollbar.track.indexOf("%23c0c0c0") !== -1 &&
    /* all four directions, so a box that scrolls sideways has its arrows too */
    ["vertical:decrement", "vertical:increment", "horizontal:decrement", "horizontal:increment"]
      .every((way) => siteCss.includes("webkit-scrollbar-button:single-button:" + way)),
    JSON.stringify(scrollbar));

  /* The command boxes scroll sideways too, so they take the same bar rather than
     the browser's own: a 16px horizontal bar in Chromium, the overlay in Firefox. */
  const cmdBar = await evaluate(client,
    "(function () {" +
    "  var box = document.querySelector('#install-oneliner').closest('.cmd-box');" +
    "  function style(sel) { return getComputedStyle(box, sel); }" +
    "  return { height: style('::-webkit-scrollbar').height," +
    "           width: style('::-webkit-scrollbar').width," +
    "           thumb: style('::-webkit-scrollbar-thumb').backgroundColor };" +
    "})()");
  check("the command boxes carry the same retro bar, so a long line scrolls sideways in style",
    cmdBar.height === "16px" && cmdBar.width === "16px" &&
    cmdBar.thumb === "rgb(192, 192, 192)", JSON.stringify(cmdBar));
}
