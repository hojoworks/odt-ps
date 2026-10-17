/* The rail mark, the greeter, the anchored landing and the clean refresh. */

export async function run(ctx) {
  const { client, check, evaluate, wait, waitFor, pickVersion, XML_IS_CONSISTENT } = ctx;
  /* ---- the rail marks the chosen step, and nothing else ----
     Scrolling a mid-page section into view must leave the rail where the reader
     put it: a highlight that chased the scroll could only ever trail it. */
  await evaluate(client, "document.getElementById('s-languages').scrollIntoView()");
  await wait(700);
  const held = await evaluate(client,
    "(function () {" +
    "  var content = document.querySelector('.setup-content').getBoundingClientRect();" +
    "  return { chosen: document.querySelector('#rail-steps li.current .step-name').textContent," +
    "           reached: document.querySelector('#s-languages h2').getBoundingClientRect().top < content.bottom," +
    "           moved: Math.round(document.querySelector('.setup-content').scrollTop) };" +
    "})()");
  check("the rail holds the chosen step while the page scrolls under it",
    held.chosen === "Configuration Presets" && held.reached === true && held.moved > 0,
    JSON.stringify(held));

  /* ---- the greeter in the status bar ----
     One line of credits, held twice over so the walk loops without a seam, and
     paced from the measured width of a copy rather than a guessed duration. */
  const greeter = await evaluate(client,
    "(function () {" +
    "  var track = document.getElementById('greeter-track');" +
    "  var panel = document.querySelector('.setup-status .greeter');" +
    "  var cs = track ? getComputedStyle(track) : null;" +
    "  var credits = (document.getElementById('greeter-credits') || {}).textContent || '';" +
    "  var text = track ? track.textContent : '';" +
    "  var half = Math.floor(text.length / 2);" +
    "  return { seamed: text.length > 0 && text.length % 2 === 0 &&" +
    "             text.slice(0, half) === text.slice(half)," +
    "           length: text.length," +
    "           wider: track ? track.scrollWidth > panel.clientWidth : false," +
    "           panel: panel ? Math.round(panel.getBoundingClientRect().height) : 0," +
    "           animated: cs ? cs.animationName : ''," +
    "           seconds: cs ? parseFloat(cs.animationDuration) : 0," +
    "           credits: credits.length };" +
    "})()");
  check("the status bar walks one greeter line, its two halves identical so the loop has no seam",
    greeter.seamed === true && greeter.length > 300 && greeter.wider === true &&
    greeter.panel === 20 && greeter.animated === "greeter-walk" &&
    greeter.seconds > 5 && greeter.credits > 150, JSON.stringify(greeter));

  /* The bar walks whatever the reader's motion preference is. This is on purpose
     and is the point of a greeter: a status bar that only moves sometimes reads
     as a status bar that is broken. */
  await client.send("Emulation.setEmulatedMedia",
    { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await wait(200);
  const unmoved = await evaluate(client,
    "getComputedStyle(document.getElementById('greeter-track')).animationName");
  await client.send("Emulation.setEmulatedMedia", { features: [] });
  check("the greeter keeps walking even when the reader asks for less motion",
    unmoved === "greeter-walk", JSON.stringify({ animationName: unmoved }));

  /* A rail step glides rather than jumps, hands the keyboard to the sections so
     Page Down scrolls them instead of the rail, and leaves the address bar
     alone: the sections are not linkable places. */
  await evaluate(client, "document.querySelector('.rail-steps [data-section=\"s-version\"]').click()");
  let glide = null;
  await waitFor(async () => {
    glide = await evaluate(client,
      "(function () {" +
      "  var box = document.querySelector('.setup-content').getBoundingClientRect();" +
      "  var head = document.querySelector('#s-version h2').getBoundingClientRect();" +
      "  return { delta: Math.round(head.top - box.top)," +
      "           focused: document.activeElement === document.querySelector('.setup-content')," +
      "           href: location.href };" +
      "})()");
    return glide.delta >= 0 && glide.delta <= 30;
  }, 2000);
  check("a rail step glides to its section, keeps the keyboard and never touches the URL",
    glide !== null && glide.delta >= 0 && glide.delta <= 30 &&
    glide.focused === true && glide.href.indexOf("#") === -1, JSON.stringify(glide));

  /* A section near the foot cannot be scrolled to the top at all, so its step
     has to be named by the click rather than by where the scroll ends up. */
  await evaluate(client, "document.querySelector('.rail-steps [data-section=\"s-options\"]').click()");
  await wait(700);
  const pinned = await evaluate(client,
    "(function () {" +
    "  var content = document.querySelector('.setup-content');" +
    "  return { rail: (document.querySelector('#rail-steps li.current .step-name') || {}).textContent," +
    "           atFoot: content.scrollTop + content.clientHeight >= content.scrollHeight - 2 };" +
    "})()");
  check("a step whose section cannot reach the top still names itself",
    pinned.rail === "Advanced options" && pinned.atFoot === true, JSON.stringify(pinned));

  /* A section must land with its heading below the title bar, never under it. */
  const anchored = await evaluate(client,
    "(function () {" +
    "  document.getElementById('s-options').scrollIntoView();" +
    "  var heading = document.querySelector('#s-options h2').getBoundingClientRect();" +
    "  var bar = document.getElementById('setup-titlebar').getBoundingClientRect();" +
    "  var content = document.querySelector('.setup-content').getBoundingClientRect();" +
    "  return { headingTop: Math.round(heading.top), contentTop: Math.round(content.top)," +
    "           barBottom: Math.round(bar.bottom)," +
    "           visible: heading.top >= bar.bottom && heading.top < content.bottom };" +
    "})()");
  check("an anchored section lands with its heading below the title bar",
    anchored.visible === true && anchored.headingTop >= anchored.contentTop - 1, JSON.stringify(anchored));

  await evaluate(client, "location.reload()");
  await wait(1400);
  const afterReload = await evaluate(client,
    "(function () {" +
    "  return { product: window.SETUP.api.state().product," +
    "           ticked: document.querySelectorAll('#version-body input[data-product]:checked').length };" +
    "})()");
  check("a refresh starts clean: nothing is remembered",
    afterReload.product === "" && afterReload.ticked === 0, JSON.stringify(afterReload));

  const warning = await evaluate(client,
    "(function () {" +
    "  var box = document.querySelector('#version-body input[data-product=\"O365ProPlusRetail\"]');" +
    "  box.checked = true;" +
    "  box.dispatchEvent(new Event('change', { bubbles: true }));" +
    "  var event = new Event('beforeunload', { cancelable: true });" +
    "  window.dispatchEvent(event);" +
    "  return { prevented: event.defaultPrevented, willWarn: window.SETUP.api.willWarn() };" +
    "})()");
  check("leaving with choices made asks the browser to warn",
    warning.prevented === true && warning.willWarn === true, JSON.stringify(warning));

  const presets = await evaluate(client,
    "(function () {" +
    "  var buttons = document.querySelectorAll('#presets-body .preset');" +
    "  var style = getComputedStyle(buttons[0]);" +
    "  return { count: buttons.length," +
    "           chiselled: style.borderTopColor === 'rgb(255, 255, 255)' &&" +
    "                      style.borderRightColor === 'rgb(0, 0, 0)'," +
    "           names: Array.prototype.map.call(buttons, function (b) {" +
    "             return b.querySelector('.preset-name').textContent; }).join(' | ') };" +
    "})()");
  check("four chiselled presets are offered", presets.count === 4 && presets.chiselled === true,
    JSON.stringify(presets));
  check("the presets are the four named starting points",
    presets.names === "Hojo's Choice | M365 Apps | M365 Apps + Project & Visio | LTSC ProPlus 2024",
    JSON.stringify(presets));

  const applied = await evaluate(client,
    "(function () {" +
    "  var before = window.SETUP.api.state().product;" +
    "  document.querySelector('#presets-body .preset[data-preset=\"ltsc-2024\"]').click();" +
    "  var after = window.SETUP.api.state();" +
    "  return { before: before, product: after.product, arch: after.arch," +
    "           versionMode: after.versionMode, removeMsi: after.removeMsi," +
    "           consistent: " + XML_IS_CONSISTENT + " };" +
    "})()");
  check("clicking a preset fills the whole form in",
    applied.before !== applied.product && applied.product === "ProPlus2024Volume" &&
    applied.arch === "64" && applied.versionMode === "latest" && applied.removeMsi === true &&
    applied.consistent === true, JSON.stringify(applied));

  /* The first preset is the house choice, and these are the exact settings it
     has to put in the form. */
  const house = await evaluate(client,
    "(function () {" +
    "  document.querySelector('#presets-body .preset[data-preset=\"hojos-choice\"]').click();" +
    "  var s = window.SETUP.api.state();" +
    "  return { first: document.querySelector('#presets-body .preset .preset-name').textContent," +
    "           product: s.product, arch: s.arch, channel: s.channel, mode: s.versionMode," +
    "           excluded: s.excludeApps.join(','), languages: s.languages.join(',')," +
    "           addons: s.addons.join(',') };" +
    "})()");
  check("the first preset is Hojo's Choice: 64-bit 365 Apps with Visio and Project, monthly, minus the extras",
    house.first === "Hojo's Choice" && house.product === "O365ProPlusRetail" &&
    house.arch === "64" && house.channel === "MonthlyEnterprise" && house.mode === "latest" &&
    house.languages === "en-us" &&
    house.excluded === "Outlook,OneNote,Access,Publisher,Teams,Groove,OneDrive,Lync,OutlookForWindows" &&
    house.addons === "VisioProRetail,ProjectProRetail", JSON.stringify(house));

  /* A short box gives the description about one line: it must fit, never scroll,
     and never reserve a scrollbar gutter beside the text. */
  const shortPanes = await evaluate(client,
    "(function () {" +
    "  var out = [];" +
    "  ['#edition-body', '#build-body'].forEach(function (selector) {" +
    "    var pane = document.querySelector(selector + ' .pick-desc p');" +
    "    var cs = getComputedStyle(pane);" +
    "    var borders = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);" +
    "    out.push({ where: selector, overflow: cs.overflowY, gutter: cs.scrollbarGutter," +
    "               bare: Math.abs((pane.offsetWidth - pane.clientWidth) - borders) <= 0.5," +
    "               fits: pane.scrollHeight <= pane.clientHeight + 1 });" +
    "  });" +
    "  return out;" +
    "})()");
  check("the Edition and Build descriptions fit and never show a scrollbar",
    shortPanes.every((p) => p.overflow === "hidden" && p.gutter === "auto" &&
      p.bare === true && p.fits === true), JSON.stringify(shortPanes));

  /* Leaving with the chosen version un-ticked returns to the greyed-out state. */
  const cleared = await evaluate(client,
    "(function () {" +
    "  var radio = document.querySelector('#version-body input[data-product=\"O365ProPlusRetail\"]');" +
    "  radio.checked = false;" +
    "  radio.dispatchEvent(new Event('change', { bubbles: true }));" +
    "  var list = document.querySelector('#apps-body .pick-list');" +
    "  return { product: window.SETUP.api.state().product," +
    "           idle: list.classList.contains('is-idle')," +
    "           ticked: document.querySelectorAll('#version-body input[data-product]:checked').length };" +
    "})()");
  check("un-ticking the version clears it and greys the apps list again",
    cleared.product === "" && cleared.ticked === 0 && cleared.idle === true, JSON.stringify(cleared));

  /* The scroll area marks its own edges with a fading shadow, and each one only
     appears while there is more content that way. */
  const bandProbe = (extra) =>
    "(function () {" +
    "  var content = document.querySelector('.setup-content');" +
    "  function band(pseudo) {" +
    "    var cs = getComputedStyle(content, pseudo);" +
    "    return { display: cs.display, position: cs.position," +
    "             fades: cs.backgroundImage.indexOf('linear-gradient') !== -1 };" +
    "  }" +
    extra +
    "  return { above: content.classList.contains('has-above')," +
    "           below: content.classList.contains('has-below')," +
    "           before: band('::before'), after: band('::after') };" +
    "})()";
  await evaluate(client, "document.querySelector('.setup-content').scrollTop = 0");
  await wait(200);
  const atTop = await evaluate(client, bandProbe(""));
  await evaluate(client, "(function () { var c = document.querySelector('.setup-content');" +
    " c.scrollTop = Math.round(c.scrollHeight / 2); })()");
  await wait(200);
  const atMiddle = await evaluate(client, bandProbe(""));
  await evaluate(client, "(function () { var c = document.querySelector('.setup-content');" +
    " c.scrollTop = c.scrollHeight; })()");
  await wait(200);
  const atBottom = await evaluate(client, bandProbe(""));
  check("the scrolling area fades at the top and bottom edges, and only where there is more",
    atTop.above === false && atTop.below === true && atTop.before.display === "none" &&
    atTop.after.display === "block" && atTop.after.fades === true && atTop.after.position === "sticky" &&
    atMiddle.above === true && atMiddle.below === true &&
    atMiddle.before.display === "block" && atMiddle.before.fades === true &&
    atMiddle.before.position === "sticky" && atMiddle.after.fades === true &&
    atBottom.above === true && atBottom.below === false && atBottom.after.display === "none",
    JSON.stringify({ atTop: atTop, atMiddle: atMiddle, atBottom: atBottom }));
}
