/* Headless checks for the wizard logic. Run with: node tools/check-wizard.mjs */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { decodePng } from "./png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Mirror a browser: `window` is the global object, so `window.ODT = ...`
// also creates the bare `ODT` binding the site scripts rely on.
const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of ["site/odt-data.js", "site/odt-xml.js"]) {
  vm.runInContext(readFileSync(join(root, file), "utf8"), sandbox, { filename: file });
}
const ODT = sandbox.window.ODT;

let failures = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) {
    failures++;
    console.log(`FAIL ${name}`);
    console.log("  expected: " + JSON.stringify(expected));
    console.log("  actual  : " + JSON.stringify(actual));
  } else {
    console.log(`ok   ${name}`);
  }
}
function contains(name, haystack, needle) {
  const ok = haystack.includes(needle);
  if (!ok) {
    failures++;
    console.log(`FAIL ${name} (missing ${JSON.stringify(needle)})`);
    console.log(haystack);
  } else {
    console.log(`ok   ${name}`);
  }
}

/* For plain boolean assertions, where `check` compares two values. */
function verify(name, condition, detail) {
  if (condition) {
    console.log(`ok   ${name}`);
  } else {
    failures++;
    console.log(`FAIL ${name}${detail !== undefined ? "\n  " + String(detail).slice(0, 400) : ""}`);
  }
}

const base = {
  product: "O365ProPlusRetail",
  addons: [],
  languages: ["en-us"],
  excludeApps: [],
  arch: "64",
  channel: "Current",
  removeMsi: true,
  removeExisting: false,
  sharedComputer: false,
  deviceBased: false,
  keepUpdated: true,
  displayLevel: "None",
  acceptEula: true,
  forceAppShutdown: true
};

/* 1. Typical setup: defaults only. */
const typical = ODT.buildXml(base);
contains("typical: root element", typical, "<Configuration>");
contains("typical: product", typical, '<Product ID="O365ProPlusRetail">');
contains("typical: language", typical, '<Language ID="en-us" />');
contains("typical: channel", typical, 'Channel="Current"');
contains("typical: architecture", typical, 'OfficeClientEdition="64"');
contains("typical: MSI cleanup", typical, "<RemoveMSI />");
check("typical: no Remove All", typical.includes('<Remove All="TRUE" />'), false);

/* 2. Add-ons, second language, excluded apps. */
const rich = ODT.buildXml({
  ...base,
  addons: ["VisioProRetail", "ProjectProRetail"],
  languages: ["en-us", "de-de"],
  excludeApps: ["Publisher", "Teams"]
});
contains("rich: visio", rich, '<Product ID="VisioProRetail">');
contains("rich: project", rich, '<Product ID="ProjectProRetail">');
contains("rich: second language", rich, '<Language ID="de-de" />');
contains("rich: exclude publisher", rich, '<ExcludeApp ID="Publisher" />');
contains("rich: exclude teams", rich, '<ExcludeApp ID="Teams" />');
check("rich: excludes only once per app", rich.split('ID="Publisher"').length - 1, 1);

/* 3. Excludes are only valid for suites. */
const runtime = ODT.buildXml({ ...base, product: "AccessRuntimeRetail", excludeApps: ["Publisher"] });
check("access runtime: no ExcludeApp", runtime.includes("ExcludeApp"), false);

/* 4. LTSC 2024: channel forced, 32-bit ignored, add-ons must match the family. */
const ltsc = ODT.buildXml({
  ...base,
  product: "ProPlus2024Volume",
  arch: "32",
  channel: "Current",
  addons: ["VisioProRetail", "VisioPro2024Volume"]
});
contains("ltsc2024: channel forced", ltsc, 'Channel="PerpetualVL2024"');
contains("ltsc2024: stays 64-bit", ltsc, 'OfficeClientEdition="64"');
contains("ltsc2024: matching add-on kept", ltsc, '<Product ID="VisioPro2024Volume">');
check("ltsc2024: mismatched add-on dropped", ltsc.includes("VisioProRetail"), false);
check("ltsc2024: warns about 32-bit", ODT.dataWarnings({ ...base, product: "ProPlus2024Volume", arch: "32" })
  .some(w => w.includes("64-bit only")), true);

/* 5. LTSC 2021 can still be 32-bit. */
const ltsc21 = ODT.buildXml({ ...base, product: "ProPlus2021Volume", arch: "32" });
contains("ltsc2021: 32-bit kept", ltsc21, 'OfficeClientEdition="32"');
contains("ltsc2021: channel", ltsc21, 'Channel="PerpetualVL2021"');

/* 6. Custom options land in the XML. */
const custom = ODT.buildXml({
  ...base,
  removeExisting: true,
  sharedComputer: true,
  keepUpdated: false,
  displayLevel: "Full"
});
contains("custom: remove all", custom, '<Remove All="TRUE" />');
contains("custom: shared computer", custom, '<Property Name="SharedComputerLicensing" Value="1" />');
contains("custom: updates off", custom, '<Updates Enabled="FALSE" />');
contains("custom: display full", custom, '<Display Level="Full"');

/* 7. MatchOS fallback. */
contains("matchos: fallback emitted",
  ODT.buildXml({ ...base, languages: ["en-us", "MatchOS"], matchOsFallback: "en-us" }),
  '<Language ID="MatchOS" Fallback="en-us" />');

/* 8. Command lines mirror the selections. */
check("command: typical", ODT.buildCommand(base),
  ".\\get.ps1 -Product O365ProPlusRetail -Languages en-us -Download -Install -Silent");
check("command: a shown setup window is asked for", ODT.buildCommand({ ...base, displayLevel: "Full" }),
  ".\\get.ps1 -Product O365ProPlusRetail -Languages en-us -ShowWindow -Download -Install -Silent");
check("command: keeping the downloaded files is asked for",
  ODT.buildCommand({ ...base, keepFiles: true }),
  ".\\get.ps1 -Product O365ProPlusRetail -Languages en-us -KeepFiles -Download -Install -Silent");
check("command: the XML carries the display level",
  ODT.buildXml({ ...base, displayLevel: "Full" }).includes('<Display Level="Full" AcceptEULA="TRUE" />'), true);
check("command: custom bits", ODT.buildCommand({
  ...base,
  addons: ["VisioProRetail"],
  languages: ["en-us", "de-de"],
  arch: "32",
  channel: "MonthlyEnterprise",
  excludeApps: ["Publisher"]
}),
  ".\\get.ps1 -Product O365ProPlusRetail,VisioProRetail -Languages en-us,de-de -Arch 32 -Channel MonthlyEnterprise -Exclude Publisher -Download -Install -Silent");
check("command: a pinned build is carried by the command line",
  ODT.buildCommand({ ...base, version: "16.0.17928.20156" }),
  ".\\get.ps1 -Product O365ProPlusRetail -Languages en-us -Version 16.0.17928.20156 -Download -Install -Silent");

/* 9. Summary rows cover everything the install page shows. */
const rows = ODT.summary({ ...base, languages: ["en-us", "de-de"], excludeApps: ["Teams"] });
const rowText = JSON.stringify(rows);
check("summary: every row is labelled",
  ["Version", "Also installing", "Channel", "Build", "Edition", "Languages", "Excluding", "Options"]
    .every((label) => rowText.includes(`"${label}"`)), true, rowText);
contains("summary: language names", rowText, "English (US), German");
contains("summary: exclusions", rowText, "Microsoft Teams");

/* 10. Version handling. */
contains("version: build number in XML",
  ODT.buildXml({ ...base, version: "16.0.17928.20156" }),
  'Version="16.0.17928.20156"');
contains("version: MatchInstalled in XML",
  ODT.buildXml({ ...base, matchInstalled: true }),
  'Version="MatchInstalled"');
contains("version: command line carries it",
  ODT.buildCommand({ ...base, version: "16.0.17928.20156" }),
  "-Version 16.0.17928.20156");
check("version: MatchInstalled warns about /download",
  ODT.dataWarnings({ ...base, matchInstalled: true }).some(w => w.includes("/download")), true);
check("version: malformed build warns",
  ODT.dataWarnings({ ...base, version: "16.0.bad" }).some(w => w.includes("16.0.XXXXX")), true);
check("version: no version means no attribute", ODT.buildXml(base).includes("Version="), false);

/* 11. No build numbers are written down: Microsoft publishes a new one every
   month, so anything hard-coded here would be stale within weeks. */
const channelData = JSON.stringify(ODT.channelInfo);
verify("builds: no channel carries a build or release date",
  !/\d{5}\.\d{5}/.test(channelData) && !/released/i.test(channelData) && channelData.indexOf("2609") === -1,
  channelData);
verify("builds: channels still explain themselves",
  ODT.channelInfo.Current.note.length > 10 && ODT.channelInfo.SemiAnnual.note.indexOf("Monthly Enterprise") !== -1,
  channelData);
const pinnedRows = ODT.summary({ ...base, version: "16.0.17928.20156" });
check("builds: a pinned build still reaches the summary",
  pinnedRows.filter((row) => row[0] === "Build")[0][1], "16.0.17928.20156");

/* 12. The generated backdrop asset is the dithered ramp we expect. */
const backdrop = readFileSync(join(root, "site", "backdrop.svg"), "utf8");
verify("backdrop: 58 dithered steps", (backdrop.match(/fill='url\(#/g) || []).length === 58,
  (backdrop.match(/fill='url\(#/g) || []).length);
const backdropColours = [...new Set((backdrop.match(/#[0-9a-f]{6}/g) || []).map((c) => c.toLowerCase()))].sort();
verify("backdrop: palette colours only, 2x2 dots, stretched rather than letterboxed",
  backdropColours.join(" ") === "#000000 #000080 #0000ff" &&
  backdrop.includes("width='2' height='2'") && backdrop.includes("preserveAspectRatio='none'"),
  backdropColours.join(" "));
verify("backdrop: flat blue under the screen title",
  backdrop.includes("<rect x='0' y='0' width='8' height='96' fill='#0000ff'/>"));

/* 12b. The share card, and the one address the page claims. Both are files the
   suites read rather than rebuild: the card needs a browser to make. */
const card = readFileSync(join(root, "site", "og-card.png"));
const png = card.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
verify("og card: a PNG, 1200x630, the size the head declares",
  png && card.readUInt32BE(16) === 1200 && card.readUInt32BE(20) === 630,
  (png ? "" : "not a PNG, ") + card.readUInt32BE(16) + "x" + card.readUInt32BE(20));

const markup = readFileSync(join(root, "site", "index.html"), "utf8");
const canonical = (markup.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
const sitemap = readFileSync(join(root, "site", "sitemap.xml"), "utf8");
verify("sitemap: the same address as the canonical link",
  canonical === "https://hojoworks.github.io/odt-ps/" &&
  sitemap.includes("<loc>" + canonical + "</loc>"),
  "canonical " + canonical + ", sitemap " + (sitemap.match(/<loc>([^<]+)<\/loc>/) || [])[1]);

/* 10. Every product in the data file produces valid-looking XML. */
let allOk = true;
for (const product of ODT.products) {
  const xml = ODT.buildXml({ ...base, product: product.id });
  if (!xml.startsWith("<Configuration>") || !xml.endsWith("</Configuration>") ||
      !xml.includes('ID="' + product.id + '"')) {
    allOk = false;
    console.log("  broken product: " + product.id);
  }
}
check("all products generate XML", allOk, true);

/* 13. Every script we ship parses. A quoting slip in the render code would
   otherwise only show up as a blank page in the browser. */
["site/odt-data.js", "site/odt-xml.js", "site/ui.js", "site/setup-core.js", "site/setup-sections.js", "site/setup-rail.js", "site/wizard.js"].forEach((file) => {
  let error = null;
  try {
    new vm.Script(readFileSync(join(root, file), "utf8"), { filename: file });
  } catch (err) {
    error = err.message;
  }
  verify("parses: " + file, error === null, error);
});

/* 13b. The installer keeps its own house in order: every helper it calls is
   defined, every helper it defines is called, and none is defined twice. A
   function deleted while a call to it survives only fails when that branch runs,
   which is how a release once went out calling something that was no longer
   there. Comments are stripped first, so prose cannot look like a call either. */
const installerSource = readFileSync(join(root, "get.ps1"), "utf8")
  .replace(/<#[\s\S]*?#>/g, (block) => block.replace(/[^\n]/g, " "))
  /* split on either ending: git checks this file out with CRLF on Linux, and an
     indexOf over "\n)\n" quietly fails on a \r */
  .split(/\r?\n/).map((line) => {
    const comment = line.indexOf("#");
    return comment < 0 ? line : line.slice(0, comment).replace(/[^\n]/g, " ");
  }).join("\n");
const installerDefined = [...installerSource.matchAll(/^\s*function\s+([A-Za-z0-9]+-[A-Za-z0-9]+)/gm)]
  .map((match) => match[1]);
const installerCalled = [...new Set([...installerSource.matchAll(
  /(?:^\s*|[|{;(=,]\s*)([A-Z][a-zA-Z]+-[A-Z][a-zA-Z0-9]+)\b/gm)].map((match) => match[1]))];
const installerBuiltins = new Set(["Clear-Host", "ForEach-Object", "Get-ChildItem", "Get-Date",
  "Get-ItemProperty", "Get-Process", "Invoke-WebRequest", "Join-Path", "New-Item", "New-Object",
  "Out-Null", "Out-String", "Read-Host", "Remove-Item", "Select-Object", "Sort-Object", "Split-Path",
  "Start-Sleep", "Start-Process", "Stop-Process", "Test-Path", "Where-Object", "Write-Host"]);
verify("installer: every helper it calls is defined, or a cmdlet it may use",
  installerCalled.every((name) => installerDefined.includes(name) || installerBuiltins.has(name)),
  installerCalled.filter((name) => !installerDefined.includes(name) && !installerBuiltins.has(name)).join(", ") || "all resolved");
verify("installer: every helper it defines is called",
  installerDefined.every((name) => installerCalled.includes(name)),
  installerDefined.filter((name) => !installerCalled.includes(name)).join(", ") || "all used");
/* Every setting the installer accepts has to be read somewhere: a parameter
   that is declared and then ignored is worse than one that does not exist,
   because it looks like it worked. */
const paramBlock = installerSource.match(/param\(([\s\S]*?)\n\)/);
const declaredParams = [...new Set([...(paramBlock ? paramBlock[1] : "")
  .matchAll(/\$([A-Za-z]+)/g)].map((match) => match[1]))];
const installerBody = installerSource.slice(installerSource.indexOf("\n)\n"));
const unusedParams = declaredParams.filter((name) =>
  !new RegExp("\\$" + name + "\\b").test(installerBody));
verify("installer: every parameter it declares is read somewhere",
  declaredParams.length >= 10 && unusedParams.length === 0,
  unusedParams.join(", ") || declaredParams.length + " parameters, all read");

verify("installer: no helper is defined twice",
  installerDefined.length === new Set(installerDefined).size,
  installerDefined.filter((name, index) => installerDefined.indexOf(name) !== index).join(", ") || installerDefined.length + " helpers");

/* 13c. One licence for the whole work. The icons were Apache 2.0 before they
   arrived, so the project is Apache 2.0 as well, and the attribution Apache
   requires travels in NOTICE. */
const licenceText = readFileSync(join(root, "LICENSE"), "utf8");
const notice = readFileSync(join(root, "NOTICE"), "utf8");
verify("licence: Apache 2.0, with the attribution in NOTICE",
  licenceText.includes("Apache License") && licenceText.includes("Version 2.0") &&
  notice.includes("Copyright (c)") && notice.includes("OpenOffice.org"),
  licenceText.split("\n")[0]);

/* 14b. Whatever the page lets you type has to stay inside its attribute. The build
   version is the one free-text field, and it lands in the XML, so it is the one
   place where a quote could open a second element. */
const hostileVersion = '16.0.1" /><RemoveMSI /><x y="';
const hostileXml = ODT.buildXml({ ...base, version: hostileVersion });
verify("xml: a hostile build number is escaped and cannot open a second element",
  hostileXml.indexOf('&quot; /&gt;&lt;RemoveMSI') !== -1 &&
  hostileXml.split("<RemoveMSI").length === 2 &&
  hostileXml.indexOf(hostileVersion) === -1,
  (hostileXml.match(/Version="[^"]*"/) || ["?"])[0]);

/* 14c. Both OneDrive values are real, and they are different apps. Microsoft's
   configuration reference lists OneDrive and Groove separately, its note there
   says to use Groove for OneDrive, and its own how-to for excluding OneDrive
   uses OneDrive. The page offers both, and both have to survive normalisation
   and reach the XML. */
const oneDriveXml = ODT.buildXml({ ...base, excludeApps: ["Groove", "OneDrive"] });
verify("xml: both OneDrive values are kept, and emitted the way Microsoft documents",
  ODT.normalize({ ...base, excludeApps: ["Groove", "OneDrive"] }).excludeApps.join(",") === "Groove,OneDrive" &&
  oneDriveXml.indexOf('<ExcludeApp ID="Groove" />') !== -1 &&
  oneDriveXml.indexOf('<ExcludeApp ID="OneDrive" />') !== -1,
  (oneDriveXml.match(/<ExcludeApp ID="[A-Za-z]+" \/>/g) || []).join(" "));

/* 15. The presets, and what each one leaves out. An ExcludeApp ID that is not a
   real app is ignored by some ODT versions and refused by others, so every
   preset is held to the app list itself rather than to a remembered name. */
const businessApps = ["Teams", "Groove", "OneDrive", "Lync", "OutlookForWindows"];
const knownApps = ODT.apps.map((app) => app.id);
const presets = ODT.presets;
verify("presets: four of them, and every exclusion names a real app",
  presets.length === 4 &&
  presets.every((preset) => (preset.state.excludeApps || []).every((id) => knownApps.includes(id))),
  presets.map((preset) => preset.id + ": " + (preset.state.excludeApps || []).join(",")).join(" | "));
verify("presets: Hojo's Choice is Word, Excel and PowerPoint, plus Project and Visio",
  presets[0].id === "hojos-choice" &&
  ["Word", "Excel", "PowerPoint"].every((id) => !presets[0].state.excludeApps.includes(id)) &&
  presets[0].state.excludeApps.length === knownApps.length - 3 &&
  presets[0].state.addons.join(",") === "VisioProRetail,ProjectProRetail",
  presets[0].state.excludeApps.join(","));
verify("presets: the other three leave out the business apps and nothing else",
  presets.slice(1).every((preset) =>
    preset.state.excludeApps.length === businessApps.length &&
    businessApps.every((id) => preset.state.excludeApps.includes(id))),
  presets.slice(1).map((preset) => preset.id + ": " + preset.state.excludeApps.join(",")).join(" | "));

/* 14. Icons. The page draws from one generated sheet: every icon name it
   reaches for has to have a place in icons.css, every place has to be used,
   and the sheet itself has to stay inside the 16-colour palette. */
const siteFiles = ["site/ui.js", "site/setup-core.js", "site/setup-sections.js", "site/setup-rail.js",
  "site/wizard.js", "site/odt-data.js"];
/* The stylesheets count too: the four arrows have no class of their own, so
   they reach for `var(--i-name)` instead. */
const styleFiles = ["site/base.css", "site/rail.css", "site/content.css", "site/pick.css",
  "site/scrollbars.css", "site/controls.css", "site/narrow.css"];
const markupSources = [markup].concat(siteFiles.map((file) => readFileSync(join(root, file), "utf8"))).join("\n");
const styleSources = styleFiles.map((file) => readFileSync(join(root, file), "utf8")).join("\n");
const sources = markupSources + "\n" + styleSources;
const iconCss = readFileSync(join(root, "site", "icons.css"), "utf8");
const definedVars = new Set([...iconCss.matchAll(/^\s+--(i-[a-z0-9-]+): -?\d+px -?\d+px;$/gm)]
  .map((match) => match[1]));
const classIcons = new Set([...iconCss.matchAll(/^\.(i-[a-z0-9-]+) \{ background-position: /gm)]
  .map((match) => match[1]));
const definedIcons = new Set([...definedVars, ...classIcons]);
const referencedInMarkup = [...new Set([...markupSources.matchAll(/\b(i-[a-z0-9-]+)\b/g)]
  .map((match) => match[1]))].sort();
const missingClasses = referencedInMarkup.filter((id) => !classIcons.has(id));
verify("icons: every icon the markup names has a class rule (" + referencedInMarkup.length + " named, " +
  classIcons.size + " classes)", missingClasses.length === 0, missingClasses.join(", "));
const referencedIcons = [...new Set([
  ...[...sources.matchAll(/\b(i-[a-z0-9-]+)\b/g)].map((match) => match[1]),
  /* the scrollbar arrows are placed by literal numbers; the check below holds
     those numbers to the sheet */
  "i-arrow-up", "i-arrow-down", "i-arrow-left", "i-arrow-right"
])].sort();
const missingIcons = referencedIcons.filter((id) => !definedIcons.has(id));
verify("icons: every icon the page names has a place in the sheet (" + referencedIcons.length + " used, " +
  definedIcons.size + " placed)", missingIcons.length === 0, missingIcons.join(", "));

/* and the other way round: a place nothing points at is dead weight */
const unusedIcons = [...definedIcons].filter((id) => !referencedIcons.includes(id));
verify("icons: no unused places in the sheet (" + definedIcons.size + " placed, " +
  referencedIcons.length + " used)", unusedIcons.length === 0, unusedIcons.join(", "));

verify("icons: the page links the generated sheet, and carries no inline symbol",
  markup.includes('<link rel="stylesheet" href="icons.css">') && !markup.includes("<symbol") &&
  !markup.includes("ooo11:start"),
  markup.includes("icons.css") ? "sheet linked" : "icons.css is not linked");

const PALETTE16 = new Set(["#000000", "#800000", "#008000", "#808000", "#000080", "#800080", "#008080",
  "#c0c0c0", "#808080", "#ff0000", "#00ff00", "#ffff00", "#0000ff", "#ff00ff", "#00ffff", "#ffffff"]);
const sheet = decodePng(readFileSync(join(root, "site", "icons.png")));
const sheetColours = new Set();
let sheetTransparent = false;
for (let i = 0; i < sheet.width * sheet.height; i++) {
  if (sheet.pixels[i * 4 + 3] === 0) { sheetTransparent = true; continue; }
  sheetColours.add("#" + [0, 1, 2].map((channel) =>
    sheet.pixels[i * 4 + channel].toString(16).padStart(2, "0")).join(""));
}
const offPalette = [...sheetColours].filter((colour) => !PALETTE16.has(colour));
verify("icons: the sheet is 416x42, transparent behind the drawings, and palette-only",
  sheet.width === 416 && sheet.height === 42 && sheetTransparent && offPalette.length === 0,
  sheet.width + "x" + sheet.height + ", " + sheetColours.size + " colours" +
  (sheetTransparent ? "" : ", no transparency") + (offPalette.length ? ", off palette: " + offPalette.join(", ") : ""));

/* 14d. WebKit does not resolve custom properties inside scrollbar
   pseudo-elements, so the four arrow positions are written out in scrollbars.css.
   Hold them to the sheet's own values, or a repack would silently blank them. */
const scrollbarCss = readFileSync(join(root, "site", "scrollbars.css"), "utf8");
verify("scrollbars: Firefox is detected with -moz-appearance, not the selector it now fakes",
  /^@supports \(-moz-appearance: none\)/m.test(scrollbarCss) &&
  !/^@supports not selector\(::-webkit-scrollbar\)/m.test(scrollbarCss),
  "Firefox 153 reports ::-webkit-scrollbar as supported without styling it");
const literalArrows = [...scrollbarCss.matchAll(/background-position: (-?\d+px -?\d+px);/g)]
  .map((match) => match[1]).sort();
const sheetArrows = ["up", "down", "left", "right"].map((name) => {
  const match = iconCss.match(new RegExp("--i-arrow-" + name + ": ([^;]+);"));
  return match ? match[1].trim() : "missing " + name;
}).sort();
verify("scrollbars: the four arrow positions match the sheet, written literally for WebKit",
  JSON.stringify(literalArrows) === JSON.stringify(sheetArrows),
  literalArrows.join(" | ") + " vs " + sheetArrows.join(" | "));

/* the six document pictograms come from Apache OpenOffice (see icons/ooo11) */
const ooo11 = ["i-doc", "i-grid", "i-slide", "i-db", "i-shapes", "i-chart"];
verify("icons: the six OO11 document pictograms have a place in the sheet",
  ooo11.every((id) => definedIcons.has(id)), ooo11.filter((id) => !definedIcons.has(id)).join(", "));

/* 14c. The favicon is the same artwork as a standalone PNG, doubled so a 32px
   slot is as crisp as the 16px one: the SVG it used to be was larger than the
   whole sheet, and a favicon cannot crop a region out of it. */
const faviconPng = readFileSync(join(root, "site", "favicon.png"));
verify("favicon: a 32x32 PNG, linked instead of the old SVG",
  faviconPng.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" &&
  faviconPng.readUInt32BE(16) === 32 && faviconPng.readUInt32BE(20) === 32 &&
  markup.includes('type="image/png" href="favicon.png"') && !markup.includes("favicon.svg"),
  faviconPng.readUInt32BE(16) + "x" + faviconPng.readUInt32BE(20));

/* 14. Nothing is chosen until a version is picked. */
const none = { ...base, product: "" };
check("no version: hasProduct is false", ODT.hasProduct(none), false);
check("no version: no summary rows", ODT.summary(none).length, 0);
check("no version: no command line", ODT.buildCommand(none), "");
check("no version: no warnings either", ODT.dataWarnings(none).length, 0);
check("no version: the XML says what to do",
  ODT.buildXml(none).indexOf("pick a version") !== -1, true);
check("no version: both editions are still offered", ODT.allowedArch(none).join(","), "64,32");
check("no version: 64-bit is what is resolved", ODT.resolveArch(none), "64");
check("no version: no channel is offered yet", ODT.allowedChannels(none).length, 0);

console.log("");
console.log(failures === 0 ? "all checks passed" : failures + " check(s) failed");
process.exit(failures === 0 ? 0 : 1);
