/* The window frame, the rhythm between sections, the list geometry and the one
   wheel target: everything about where things sit. */

export async function run(ctx) {
  const { client, check, evaluate, wait, waitFor, pickVersion, XML_IS_CONSISTENT } = ctx;

  const sectionIds = ["s-presets", "s-edition", "s-version", "s-build", "s-apps", "s-languages", "s-options", "s-install"];
  const sectionOrder = sectionIds.join(",");

  /* ---- layout and chrome ---- */
  const layout = await evaluate(client,
    "(function () {" +
    "  var title = document.querySelector('.screen-title');" +
    "  var win = document.getElementById('setup-window');" +
    "  var bar = document.getElementById('setup-titlebar');" +
    "  var content = document.querySelector('.setup-content');" +
    "  var a = title.getBoundingClientRect(), b = win.getBoundingClientRect();" +
    "  /* the canvas carries a couple of blank rows above the letters and a few below" +
    "     the descenders, so the spaces that have to match are ink-to-edge ones */" +
    "  var inkTop = 0, inkBottom = a.height;" +
    "  if (title.tagName === 'CANVAS') {" +
    "    var data = title.getContext('2d').getImageData(0, 0, title.width, title.height).data;" +
    "    inkTop = -1; inkBottom = -1;" +
    "    for (var y = 0; y < title.height; y++) {" +
    "      for (var x = 0; x < title.width; x++) {" +
    "        if (data[(y * title.width + x) * 4 + 3]) { if (inkTop < 0) { inkTop = y; } inkBottom = y; break; }" +
    "      }" +
    "    }" +
    "  }" +
    "  return { flushLeft: Math.abs(a.left - b.left) <= 1," +
    "           spaceAbove: Math.round(a.top + inkTop)," +
    "           spaceBelow: Math.round(b.top - (a.top + inkBottom))," +
    "           sections: " + JSON.stringify(sectionIds) + ".filter(function (id) { return !document.getElementById(id); }).length," +
    "           railItems: document.querySelectorAll('#rail-steps li').length," +
    "           order: Array.prototype.map.call(document.querySelectorAll('.setup-section'), function (s) { return s.id; }).join(',')," +
    "           railLabels: Array.prototype.map.call(document.querySelectorAll('#rail-steps li [data-section]'), function (a) { return a.getAttribute('data-section'); }).join(',')," +
    "           railNames: Array.prototype.map.call(document.querySelectorAll('#rail-steps .step-name'), function (a) { return a.textContent; }).join(',')," +
    "           headings: Array.prototype.map.call(document.querySelectorAll('.setup-section h2'), function (h) {" +
    "             var note = h.querySelector('.h2-note');" +
    "             return note ? h.textContent.slice(0, h.textContent.length - note.textContent.length) : h.textContent;" +
    "           }).join(',')," +
    "           railNotes: Array.prototype.every.call(document.querySelectorAll('#rail-steps .step-note'), function (n) { return n.textContent.trim().length > 0; })," +
    "           names: document.querySelector('.setup-title').textContent + '|' +" +
    "                  (document.querySelector('.screen-title') || {}).getAttribute('aria-label') + '|' +" +
    "                  document.title," +
    "           pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1," +
    "           contentScrolls: content.scrollHeight > content.clientHeight + 1," +
    "           contentOverflow: getComputedStyle(content).overflowY," +
    "           barAtWindowTop: Math.abs(bar.getBoundingClientRect().top - win.getBoundingClientRect().top) <= 5 };" +
    "})()");
  check("title sits flush left, with matching space above and below it",
    layout.flushLeft && Math.abs(layout.spaceAbove - layout.spaceBelow) <= 1 &&
    layout.spaceAbove >= 8 && layout.spaceAbove <= 24, JSON.stringify(layout));
  check("every section exists, in order, and the rail lists them",
    layout.sections === 0 && layout.railItems === sectionIds.length &&
    layout.order === sectionOrder && layout.railLabels === sectionOrder &&
    layout.railNames === "Configuration Presets,Choose Edition,Choose Office Version Family," +
      "Choose Build Version,Add / Remove Applications,Choose Languages,Advanced options,Install" &&
    /* every step carries a subtitle, and the heading in the page and the step in
       the rail are the same words */
    layout.railNotes === true && layout.headings === layout.railNames,
    JSON.stringify(layout));
  check("the window frame stays put and the sections scroll inside it",
    layout.pageScrolls === false && layout.contentScrolls === true &&
    layout.contentOverflow === "auto" && layout.barAtWindowTop === true, JSON.stringify(layout));
  /* The name of the thing, in the three places it is worn. The tab is the plain
     name: the description is a sentence, and a sentence does not belong in a
     tab. */
  check("the tab, the window title bar and the screen title all say the same thing",
    layout.names === "Hojo's Easy Config For ODT|Hojo's Easy Config For ODT|" +
      "Hojo's Easy Config For ODT", layout.names);

  /* How the page introduces itself when something else links to it. One address,
     one description, one name, and a card whose declared size is the size of the
     file, so a previewer never has to guess what it is getting. */
  const preview = await evaluate(client,
    "(async function () {" +
    "  function content(selector) {" +
    "    var el = document.querySelector(selector);" +
    "    return el ? el.getAttribute('content') : null;" +
    "  }" +
    "  var card = new Image();" +
    "  card.src = new URL('og-card.png', location.href).href;" +
    "  await card.decode().catch(function () { card = null; });" +
    "  return { title: document.title," +
    "           heading: (document.querySelector('h1') || {}).textContent," +
    "           description: content('meta[name=\"description\"]')," +
    "           canonical: (document.querySelector('link[rel=\"canonical\"]') || {}).href," +
    "           ogType: content('meta[property=\"og:type\"]')," +
    "           ogLocale: content('meta[property=\"og:locale\"]')," +
    "           ogTitle: content('meta[property=\"og:title\"]')," +
    "           ogDescription: content('meta[property=\"og:description\"]')," +
    "           ogUrl: content('meta[property=\"og:url\"]')," +
    "           ogImage: content('meta[property=\"og:image\"]')," +
    "           declared: content('meta[property=\"og:image:width\"]') + 'x' +" +
    "                     content('meta[property=\"og:image:height\"]')," +
    "           promising: content('meta[property=\"og:image:alt\"]')," +
    "           twitterCard: content('meta[name=\"twitter:card\"]')," +
    "           twitterTitle: content('meta[name=\"twitter:title\"]')," +
    "           twitterDescription: content('meta[name=\"twitter:description\"]')," +
    "           twitterImage: content('meta[name=\"twitter:image\"]')," +
    "           themeColor: content('meta[name=\"theme-color\"]')," +
    "           cardSize: card ? card.naturalWidth + 'x' + card.naturalHeight : 'missing' };" +
    "})()");
  const address = "https://hojoworks.github.io/odt-ps/";
  check("a link preview gets one address, one description and a card the size it claims",
    preview.canonical === address && preview.ogUrl === address &&
    preview.ogImage === address + "og-card.png" && preview.twitterImage === preview.ogImage &&
    preview.cardSize === preview.declared &&
    preview.description.length >= 70 && preview.description.length <= 250 &&
    preview.description === preview.ogDescription &&
    preview.description === preview.twitterDescription &&
    preview.title === preview.ogTitle && preview.title === preview.twitterTitle &&
    preview.ogType === "website" && preview.ogLocale === "en_GB" &&
    preview.twitterCard === "summary_large_image" &&
    preview.themeColor === "#000080" && preview.promising.length > 40, JSON.stringify(preview));

  /* The tab wears the name alone; the page's own heading is the name and the one
     sentence that says what it is, which is where a search engine reads it. */
  check("the page heading says what the page is, where the tab title name alone",
    preview.heading.indexOf(preview.title) === 0 && preview.heading.length > preview.title.length + 10,
    JSON.stringify({ title: preview.title, heading: preview.heading }));

  /* The one-column layout for a narrow window: the rail becomes a row of
     columns, the screen title is dropped, and nothing sticks out sideways. */
  await client.send("Emulation.setDeviceMetricsOverride",
    { width: 760, height: 900, deviceScaleFactor: 1, mobile: false });
  await wait(350);
  const narrow = await evaluate(client,
    "(function () {" +
    "  var view = window.innerWidth;" +
    "  var boxes = ['.setup-window', '.setup-rail', '.setup-content', '#s-presets', '#s-languages'];" +
    "  var fits = boxes.map(function (sel) {" +
    "    var r = document.querySelector(sel).getBoundingClientRect();" +
    "    return { sel: sel, left: Math.round(r.left), right: Math.round(r.right) };" +
    "  });" +
    "  var rail = document.querySelector('.setup-rail');" +
    "  return { view: view, fits: fits," +
    "           outside: fits.filter(function (b) { return b.left < -1 || b.right > view + 1; })," +
    "           railDisplay: getComputedStyle(rail).display," +
    "           railColumns: getComputedStyle(rail).gridTemplateColumns.split(' ').length > 1," +
    "           titleHidden: getComputedStyle(document.querySelector('.screen-title')).display === 'none' };" +
    "})()");
  await client.send("Emulation.clearDeviceMetricsOverride");
  await wait(350);
  check("a narrow window stacks to one column, drops the rail, and nothing sticks out sideways",
    narrow.outside.length === 0 && narrow.railDisplay === "grid" && narrow.railDisplay === "none" &&
    narrow.titleHidden === true,
    JSON.stringify({ view: narrow.view, outside: narrow.outside, railDisplay: narrow.railDisplay,
      railColumns: narrow.railColumns, titleHidden: narrow.titleHidden }));

  /* The rail's parts are held apart: the settings well sits off the steps, and
     the links sit furthest off all. */
  const railGaps = await evaluate(client,
    "(function () {" +
    "  var blocks = document.querySelectorAll('.setup-rail .rail-block');" +
    "  var gaps = [];" +
    "  for (var i = 1; i < blocks.length; i++) {" +
    "    gaps.push(Math.round(blocks[i].getBoundingClientRect().top - blocks[i - 1].getBoundingClientRect().bottom));" +
    "  }" +
    "  return gaps;" +
    "})()");
  check("the rail keeps its parts well apart, and the links furthest of all",
    railGaps.length === 2 && railGaps[0] >= 16 && railGaps[1] > railGaps[0] + 4,
    JSON.stringify(railGaps));

  /* The labels in the settings well have to be told from their values at a
     glance, so they are a colour of their own rather than another white. */
  const well = await evaluate(client,
    "(function () {" +
    "  var dt = document.querySelector('.rail-settings dt');" +
    "  var dd = document.querySelector('.rail-settings dd');" +
    "  return { label: getComputedStyle(dt).color, value: getComputedStyle(dd).color," +
    "           weight: getComputedStyle(dt).fontWeight };" +
    "})()");
  check("the settings well labels are a colour of their own, not another white",
    well.label === "rgb(255, 255, 0)" && well.value === "rgb(255, 255, 255)" &&
    well.weight === "700", JSON.stringify(well));

  /* One spacing idea: 12 px between sections, 8 px between the blocks inside
     one, and nothing carries a trailing margin. */
  const rhythm = await evaluate(client,
    "(function () {" +
    "  var sections = [].slice.call(document.querySelectorAll('.setup-section'));" +
    "  var betweenSections = [], innerGaps = {}, bottoms = [];" +
    "  sections.forEach(function (section, index) {" +
    "    var box = section.getBoundingClientRect();" +
    "    if (index) { betweenSections.push(Math.round(box.top - sections[index - 1].getBoundingClientRect().bottom)); }" +
    "    var body = section.querySelector('[id$=\"-body\"]');" +
    "    var blocks = [].slice.call(section.children).reduce(function (all, child) {" +
    "      return all.concat(child === body ? [].slice.call(child.children) : [child]);" +
    "    }, []);" +
    "    var heading = section.querySelector('h2');" +
    "    if (blocks[0] === heading) { blocks = blocks.slice(1); }" +
    "    var gaps = [];" +
    "    blocks.forEach(function (block, i) {" +
    "      var previous = i === 0 ? heading : blocks[i - 1];" +
    "      gaps.push(Math.round(block.getBoundingClientRect().top - previous.getBoundingClientRect().bottom));" +
    "    });" +
    "    innerGaps[section.id] = gaps;" +
    "    var last = section.lastElementChild.getBoundingClientRect();" +
    "    bottoms.push(Math.round(box.bottom - last.bottom));" +
    "  });" +
    "  return { betweenSections: betweenSections, innerGaps: innerGaps, bottoms: bottoms };" +
    "})()");
  check("sections and their blocks sit on one 4/4 rhythm",
    rhythm.betweenSections.every((gap) => gap === 4) &&
    Object.keys(rhythm.innerGaps).every((id) => rhythm.innerGaps[id].every((gap) => gap === 4)) &&
    rhythm.bottoms.every((gap) => gap === 4), JSON.stringify(rhythm));

  /* The side blocks and the list box are the same height by construction: the
     row height comes from --list-h / --list-h-short, so it can be worked out
     from the tokens rather than from the text. */
  const geometry = await evaluate(client,
    "(function () {" +
    "  var probe = document.createElement('div');" +
    "  document.body.appendChild(probe);" +
    "  function token(name) { probe.style.height = 'var(' + name + ')'; return Math.round(probe.getBoundingClientRect().height); }" +
    "  var sizes = {" +
    "    full: token('--list-h'), short: token('--list-h-short')," +
    "    version: token('--list-h-version'), apps: token('--list-h-apps') };" +
    "  probe.remove();" +
    "  function measure(selector, expected, rows) {" +
    "    var section = document.querySelector(selector);" +
    "    var columns = section.querySelector('.pick-columns');" +
    "    var list = columns.querySelector('.pick-list');" +
    "    var side = columns.querySelector('.pick-side');" +
    "    var pane = side.querySelector('.pick-desc');" +
    "    var text = pane ? pane.querySelector('p') : null;" +
    "    var rowH = list.querySelector('.pick').getBoundingClientRect().height;" +
    "    var cs = getComputedStyle(list);" +
    "    var chrome = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) +" +
    "                 parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);" +
    "    return { rows: rows, rowH: rowH, chrome: chrome, expected: expected," +
    "             list: Math.round(list.getBoundingClientRect().height)," +
    "             side: Math.round(side.getBoundingClientRect().height)," +
    "             hasPane: !!pane," +
    "             pane: pane ? Math.round(pane.getBoundingClientRect().height) : 0," +
    "             paneIsLast: !!pane && pane === side.lastElementChild," +
    "             lastFlush: Math.abs(side.lastElementChild.getBoundingClientRect().bottom - side.getBoundingClientRect().bottom) <= 0.5," +
    "             sideOverflows: side.scrollHeight > side.clientHeight + 1," +
    "             textReachable: !text || getComputedStyle(text).overflowY !== 'visible' ||" +
    "                            text.scrollHeight <= text.clientHeight + 1 };" +
    "  }" +
    "  return { sizes: sizes," +
    "           edition: measure('#edition-body', sizes.short, 3)," +
    "           version: measure('#version-body', sizes.version, 11)," +
    "           build: measure('#build-body', sizes.short, 3)," +
    "           languages: measure('#languages-body', sizes.full, 10)," +
    "           apps: measure('#apps-body', sizes.apps, 12) };" +
    "})()");
  const boxes = [geometry.edition, geometry.version, geometry.build, geometry.languages, geometry.apps];
  check("every list box and the blocks beside it are exactly the calculated height, flush at the bottom",
    /* rows x row height + the box's padding and border, for every list */
    boxes.every((b) => b.expected === b.rows * b.rowH + b.chrome) &&
    geometry.sizes.short === 3 * 22 + 6 && geometry.sizes.version === 11 * 22 + 6 &&
    geometry.sizes.apps === 12 * 22 + 6 &&
    boxes.every((b) => b.list === b.expected && b.side === b.expected) &&
    /* nothing hanging above the bottom edge: the channel list in Version, the
       extra languages in Languages, the description box in the rest */
    boxes.every((b) => b.lastFlush === true) &&
    /* a description box is the last block in its column, except in Version where
       the channel block sits under it; Languages has no description box at all */
    geometry.edition.paneIsLast === true && geometry.build.paneIsLast === true &&
    geometry.apps.paneIsLast === true && geometry.version.paneIsLast === false &&
    geometry.languages.hasPane === false &&
    boxes.every((b) => (b.hasPane ? b.pane > 0 : true)) &&
    boxes.every((b) => b.sideOverflows === false && b.textReachable === true),
    JSON.stringify(geometry));

  /* A longer note must never resize the description pane, its tally bar or the
     block beside it: the text takes whatever room the box gives it. */
  const paneStability = await evaluate(client,
    "(function () {" +
    "  function measure(listSelector) {" +
    "    var list = document.querySelector(listSelector);" +
    "    var side = list.closest('.pick-columns').querySelector('.pick-side');" +
    "    var pane = side.querySelector('.pick-desc');" +
    "    var text = pane.querySelector('p:not(.pick-tally)');" +
    "    var tallies = pane.querySelectorAll('.pick-tally');" +
    "    var tally = tallies.length ? tallies[tallies.length - 1] : null;" +
    "    function snap() {" +
    "      return { pane: Math.round(pane.getBoundingClientRect().height)," +
    "               text: Math.round(text.getBoundingClientRect().height)," +
    "               tallies: tallies.length," +
    "               tally: tally ? Math.round(tally.getBoundingClientRect().height) : 0," +
    "               flush: !tally || Math.abs(tally.getBoundingClientRect().bottom - pane.getBoundingClientRect().bottom) <= 1.5," +
    "               side: Math.round(side.getBoundingClientRect().height)," +
    "               scrolls: getComputedStyle(text).overflowY };" +
    "    }" +
    "    var rows = list.querySelectorAll('.pick');" +
    "    var longest = rows[0];" +
    "    rows.forEach(function (row) {" +
    "      if ((row.getAttribute('data-note') || '').length > (longest.getAttribute('data-note') || '').length) { longest = row; }" +
    "    });" +
    "    var before = snap();" +
    "    longest.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));" +
    "    return { before: before, after: snap(), note: (longest.getAttribute('data-note') || '').length };" +
    "  }" +
    "  return { apps: measure('#apps-body .pick-list')," +
    "           build: measure('#build-body .pick-list') };" +
    "})()");
  const paneFaults = ["apps", "build"].filter((name) => {
    const p = paneStability[name];
    /* the text is contained either way: auto in a tall box, hidden in a short one */
    return !(p.note > 0 && p.before.pane > 0 && p.before.text > 0 &&
      p.before.pane === p.after.pane && p.before.text === p.after.text &&
      p.before.tally === p.after.tally && p.before.tally <= 20 &&
      p.before.side === p.after.side &&
      p.before.flush === true && p.before.scrolls !== "visible");
  }).map((name) => ({ where: name, note: paneStability[name].note,
    before: paneStability[name].before, after: paneStability[name].after }));
  check("a longer note never resizes the description pane, its tally bar or the block beside it",
    paneFaults.length === 0, JSON.stringify(paneFaults));

  /* Scrolling has to behave the same wherever the pointer happens to be: the
     window's own scroll area moves, unless something inside it still has room.
     The rail is a scroller of its own on a short window (how tall it is depends
     on the font), and when it has room it takes the wheel -- that is the point
     of walking up from the pointer, so it is the one case allowed to differ. */
  await evaluate(client,
    "(function () {" +
    "  var content = document.querySelector('.setup-content');" +
    "  content.scrollTop = 0;" +
    "  document.getElementById('s-version').scrollIntoView();" +
    "})()");
  await wait(400);
  /* re-measure before every wheel: scrolling moves the targets */
  const spot = async (selector, dx, dy) => {
    /* make sure the target is really on screen before aiming at it */
    await evaluate(client, "document.querySelector('" + selector + "').scrollIntoView({ block: 'center' })");
    await wait(150);
    return evaluate(client,
      "(function () {" +
      "  var r = document.querySelector('" + selector + "').getBoundingClientRect();" +
      "  return { x: Math.round(r.left + " + dx + "), y: Math.round(r.top + " + dy + ") };" +
      "})()");
  };
  const wheel = (point, deltaY) => client.send("Input.dispatchMouseEvent",
    { type: "mouseWheel", x: point.x, y: point.y, deltaX: 0, deltaY: deltaY, button: "none" });
  const scrolled = () => evaluate(client,
    "(function () {" +
    "  return { content: Math.round(document.querySelector('.setup-content').scrollTop)," +
    "           rail: Math.round(document.querySelector('.setup-rail').scrollTop)," +
    "           langs: Math.round(document.querySelector('#languages-body .pick-list').scrollTop) };" +
    "})()");
  const contentTop = () => evaluate(client, "Math.round(document.querySelector('.setup-content').scrollTop)");

  /* wheel over something and wait for the place it should have moved */
  const wheelAt = async (selector, dx, dy, delta) => {
    const point = await spot(selector, dx, dy);
    const before = await scrolled();
    await wheel(point, delta);
    await waitFor(async () => {
      const now = await scrolled();
      return now.content !== before.content || now.rail !== before.rail || now.list !== before.list;
    }, 1200);
    return { before: before, after: await scrolled() };
  };

  const railRoom = await evaluate(client,
    "(function () { var r = document.querySelector('.setup-rail');" +
    " return r.scrollHeight > r.clientHeight + 1; })()");
  const rail = await wheelAt(".rail-steps [data-section]", 6, "r.height / 2", 240);
  const list = await wheelAt("#languages-body .pick-list", "r.width / 2", 20, 40);
  const status = await wheelAt(".setup-status", 20, 6, 240);

  check("the wheel reaches the sections from the rail, an inner list and the status bar",
    (railRoom ? rail.after.rail > rail.before.rail : rail.after.content > rail.before.content) &&
    list.after.langs > list.before.langs && list.after.content === list.before.content &&
    status.after.content > status.before.content,
    JSON.stringify({ railRoom: railRoom, rail: rail, list: list, status: status }));

  /* Reaching the end of an inner list holds the wheel for a moment before the
     window takes over, rather than chaining on the very next notch. Languages
     is the list that scrolls by design. */
  const buffered = await evaluate(client,
    "(function () {" +
    "  var list = document.querySelector('#languages-body .pick-list');" +
    "  list.scrollTop = list.scrollHeight;" +
    "  list.scrollIntoView({ block: 'center' });" +
    "  return Math.round(list.scrollTop);" +
    "})()");
  await wait(250);
  const heldBefore = await contentTop();
  await wheel(await spot("#languages-body .pick-list", "r.width / 2", 20), 120);
  await wait(250);                                   /* longer than the hold */
  const heldAfter = await contentTop();
  const releasePoint = await spot("#languages-body .pick-list", "r.width / 2", 20);
  const releaseFrom = await contentTop();
  await wheel(releasePoint, 120);
  const released = await waitFor(async () => (await contentTop()) > releaseFrom, 1200);

  check("an inner list that has run out holds the wheel briefly before the window moves",
    buffered > 0 && heldAfter === heldBefore && released === true,
    JSON.stringify({ buffered: buffered, heldBefore: heldBefore, heldAfter: heldAfter,
      releaseFrom: releaseFrom, released: released }));
}
