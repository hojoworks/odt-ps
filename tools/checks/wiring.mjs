/* Selections reaching the state, the rail and the XML, and the three outputs
   under Install. */

export async function run(ctx) {
  const { client, check, evaluate, wait, waitFor, pickVersion, XML_IS_CONSISTENT } = ctx;
  /* ---- selection wiring ---- */
  await evaluate(client,
    "(function () {" +
    "  var box = document.querySelector('#apps-body input[data-app=\"Publisher\"]');" +
    "  box.checked = false;" +
    "  box.dispatchEvent(new Event('change', { bubbles: true }));" +
    "  var ltsc = document.querySelector('#version-body input[data-product=\"ProPlus2024Volume\"]');" +
    "  ltsc.checked = true;" +
    "  ltsc.dispatchEvent(new Event('change', { bubbles: true }));" +
    "})()");
  const wiring = await evaluate(client,
    "(function () {" +
    "  var s = window.SETUP.api.state();" +
    "  var radios = document.querySelectorAll('#version-body .pick-side input[name=channel]');" +
    "  return { product: s.product, excluded: s.excludeApps.join(',')," +
    "           railText: document.getElementById('rail-settings').textContent," +
    "           channelRadios: radios.length, channelDisabled: (radios[0] || {}).disabled," +
    "           channelHeight: Math.round((radios[0] || { closest: function () { return { getBoundingClientRect: function () { return { height: 0 }; } }; } }).closest('.pick-list').getBoundingClientRect().height)," +
    "           xmlConsistent: " + XML_IS_CONSISTENT + " };" +
    "})()");
  check("un-ticking an app and picking LTSC reach the state and the rail",
    wiring.product === "ProPlus2024Volume" && wiring.excluded === "Publisher" &&
    wiring.railText.indexOf("Office LTSC Professional Plus 2024") !== -1, JSON.stringify(wiring));
  check("a version with one channel shows one fixed radio",
    wiring.channelRadios === 1 && wiring.channelDisabled === true &&
    wiring.channelHeight === 72, JSON.stringify(wiring));
  check("the page's XML matches the builder for the changed state", wiring.xmlConsistent === true);

  await evaluate(client,
    "(function () {" +
    "  var radio = document.querySelector('#build-body input[name=\"versionMode\"][value=\"installed\"]');" +
    "  radio.checked = true;" +
    "  radio.dispatchEvent(new Event('change', { bubbles: true }));" +
    "})()");
  const installed = await evaluate(client,
    "(function () {" +
    "  var liner = document.getElementById('install-oneliner').textContent;" +
    "  return { consistent: " + XML_IS_CONSISTENT + ", hasDownload: liner.indexOf('-Download') !== -1, liner: liner };" +
    "})()");
  check("MatchInstalled stays consistent and drops the download step from the one-liner",
    installed.consistent === true && installed.hasDownload === false, JSON.stringify(installed));

  /* ---- the three outputs ---- */
  await evaluate(client, "window.SETUP.api.reset()");
  await wait(200);
  await pickVersion("O365ProPlusRetail");
  const outputs = await evaluate(client,
    "(function () {" +
    "  return {" +
    "    oneLiner: document.getElementById('install-oneliner').textContent," +
    "    consistent: " + XML_IS_CONSISTENT + "," +
    "    exportLine: document.getElementById('install-export')," +
    "    odtCommands: document.getElementById('install-odt-commands').textContent," +
    "    odtLink: !!document.querySelector('#install-body a[href*=\"download/details\"]')," +
    "    summaryRows: document.querySelectorAll('#install-body .summary tr').length" +
    "  };" +
    "})()");
  check("one-liner sets ODT_ARGS and pipes get.ps1",
    /^\$env:ODT_ARGS='-Product O365ProPlusRetail -Languages en-us -ShowWindow -Download -Install -Silent'; irm https?:\/\/\S+\/get\.ps1 \| iex$/.test(outputs.oneLiner),
    outputs.oneLiner);
  /* The advanced option that keeps the files: off to start with, and ticking it
   reaches the state the command is built from. */
const keep = await evaluate(client,
  "(function () {" +
  "  var boxes = Array.prototype.slice.call(document.querySelectorAll('#options-body input'));" +
  "  var box = boxes.filter(function (input) {" +
  "    var label = input.closest('label');" +
  "    return label && label.textContent.indexOf('Keep the downloaded files') === 0;" +
  "  })[0];" +
  "  if (!box) { return { found: false }; }" +
  "  var before = box.checked;" +
  "  box.click();" +
  "  var after = window.SETUP.api.state().keepFiles;" +
  "  box.click();" +
  "  return { found: true, before: before, after: after, restored: box.checked };" +
  "})()");
check("the keep-the-files option is off by default and reaches the state when ticked",
  keep.found === true && keep.before === false && keep.after === true &&
  keep.restored === false, JSON.stringify(keep));

check("the default XML matches the builder", outputs.consistent === true);
  check("the summary lists the configuration and the outputs offered are the line, the file and the tool",
    outputs.summaryRows === 8 && outputs.exportLine === null && outputs.odtLink &&
    outputs.odtCommands.indexOf("setup.exe /configure configuration.xml") !== -1, JSON.stringify(outputs));

  /* Install is laid out as asked: Automatic Install spans the section, and the
     two manual outputs live inside a Manual Install disclosure, stacked. */
  const install = await evaluate(client,
    "(function () {" +
    "  var wrap = document.querySelector('#install-body .build-cards');" +
    "  var manual = wrap.querySelector('details.manual');" +
    "  var automatic = wrap.querySelector('.build-card');" +
    "  var cards = manual.querySelectorAll('.build-card');" +
    "  function box(el) { var r = el.getBoundingClientRect();" +
    "    return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) }; }" +
    "  var shut = { open: manual.open, cards: cards.length };" +
    "  manual.open = true;" +
    "  return { width: Math.round(wrap.getBoundingClientRect().width)," +
    "           automatic: box(automatic), shut: shut," +
    "           first: box(cards[0]), second: box(cards[1])," +
    "           xmlBox: Math.round(wrap.querySelector('.xml-box').getBoundingClientRect().height)," +
    "           title: automatic.querySelector('h3').textContent.trim()," +
    "           summary: manual.querySelector('summary').textContent.trim() };" +
    "})()");
  check("Install offers an automatic route and a stacked Manual Install disclosure",
    install.title === "Automatic Install" && install.summary === "Manual Install" &&
    install.shut.open === false && install.shut.cards === 2 &&
    Math.abs(install.automatic.w - install.width) <= 1 &&
    Math.abs(install.first.w - install.width) <= 1 &&
    Math.abs(install.second.w - install.width) <= 1 &&
    install.first.top < install.second.top &&
    install.xmlBox >= 100 && install.xmlBox <= 160, JSON.stringify(install));

  await evaluate(client,
    "(function () {" +
    "  var radio = document.querySelector('#version-body .pick-side input[name=channel][value=\"MonthlyEnterprise\"]');" +
    "  radio.checked = true;" +
    "  radio.dispatchEvent(new Event('change', { bubbles: true }));" +
    "})()");
  const channel = await evaluate(client,
    "(function () { return { channel: window.SETUP.api.state().channel," +
    "  consistent: " + XML_IS_CONSISTENT + "," +
    "  rail: document.getElementById('rail-settings').textContent }; })()");
  check("picking a channel radio reaches the state, the rail and the XML",
    channel.channel === "MonthlyEnterprise" && channel.consistent === true &&
    channel.rail.indexOf("Monthly Enterprise") !== -1, JSON.stringify(channel));
}
