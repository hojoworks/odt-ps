/* Headless checks for the wizard logic. Run with: node tools/check-wizard.mjs */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

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
contains("summary: language names", rowText, "English, German");
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
  .split("\n").map((line) => {
    const comment = line.indexOf("#");
    return comment < 0 ? line : line.slice(0, comment).replace(/[^\n]/g, " ");
  }).join("\n");
const installerDefined = [...installerSource.matchAll(/^\s*function\s+([A-Za-z0-9]+-[A-Za-z0-9]+)/gm)]
  .map((match) => match[1]);
const installerCalled = [...new Set([...installerSource.matchAll(
  /(?:^\s*|[|{;(=,]\s*)([A-Z][a-zA-Z]+-[A-Z][a-zA-Z0-9]+)\b/gm)].map((match) => match[1]))];
const installerBuiltins = new Set(["Clear-Host", "ForEach-Object", "Get-ChildItem", "Get-Date",
  "Get-ItemProperty", "Get-Process", "Invoke-WebRequest", "Join-Path", "New-Item", "New-Object",
  "Out-Null", "Out-String", "Read-Host", "Select-Object", "Sort-Object", "Split-Path",
  "Start-Sleep", "Start-Process", "Stop-Process", "Test-Path", "Where-Object", "Write-Host"]);
verify("installer: every helper it calls is defined, or a cmdlet it may use",
  installerCalled.every((name) => installerDefined.includes(name) || installerBuiltins.has(name)),
  installerCalled.filter((name) => !installerDefined.includes(name) && !installerBuiltins.has(name)).join(", ") || "all resolved");
verify("installer: every helper it defines is called",
  installerDefined.every((name) => installerCalled.includes(name)),
  installerDefined.filter((name) => !installerCalled.includes(name)).join(", ") || "all used");
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

/* 14. Icons. Every symbol the page points at has to exist, and every symbol has
   to stay inside the 16-colour palette the screen is drawn from. */
const page = readFileSync(join(root, "site", "index.html"), "utf8");
const siteFiles = ["site/ui.js", "site/setup-core.js", "site/setup-sections.js", "site/setup-rail.js",
  "site/wizard.js", "site/odt-data.js"];
const sources = [page].concat(siteFiles.map((file) => readFileSync(join(root, file), "utf8"))).join("\n");
const definedIcons = new Set([...page.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
/* Strip the definitions before looking for uses: otherwise every symbol would
   count as a reference to itself, which would make the checks meaningless. */
const usesOnly = sources
  .replace(/<symbol[\s\S]*?<\/symbol>/g, "")
  .replace(/<!-- ooo11:start -->[\s\S]*?<!-- ooo11:end -->/g, "");
const referencedIcons = [...new Set([
  ...[...usesOnly.matchAll(/href="#(i-[a-z0-9-]+)"/g)].map((m) => m[1]),
  ...[...usesOnly.matchAll(/["'](i-[a-z0-9-]+)["']/g)].map((m) => m[1])
])].sort();
const missingIcons = referencedIcons.filter((id) => !definedIcons.has(id));
verify("icons: every referenced symbol is defined (" + referencedIcons.length + " used, " +
  definedIcons.size + " defined)", missingIcons.length === 0, missingIcons.join(", "));

/* and the other way round: a symbol nothing points at is dead weight */
const unusedIcons = [...definedIcons].filter((id) => !referencedIcons.includes(id));
verify("icons: no unreferenced symbols (" + definedIcons.size + " defined, " +
  referencedIcons.length + " used)", unusedIcons.length === 0, unusedIcons.join(", "));

const PALETTE16 = new Set(["#000000", "#800000", "#008000", "#808000", "#000080", "#800080", "#008080",
  "#c0c0c0", "#808080", "#ff0000", "#00ff00", "#ffff00", "#0000ff", "#ff00ff", "#00ffff", "#ffffff"]);
const symbolColours = new Set([...page.matchAll(/<symbol[\s\S]*?<\/symbol>/g)]
  .flatMap((block) => [...block[0].matchAll(/fill="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1].toLowerCase())));
const offPalette = [...symbolColours].filter((colour) => !PALETTE16.has(colour));
verify("icons: every symbol uses only the 16-colour palette (" + symbolColours.size + " colours)",
  offPalette.length === 0, offPalette.join(", "));

/* the six document pictograms come from Apache OpenOffice (see icons/ooo11) */
const ooo11 = ["i-doc", "i-grid", "i-slide", "i-db", "i-shapes", "i-chart"];
verify("icons: the six OO11 document pictograms are present",
  ooo11.every((id) => definedIcons.has(id)), ooo11.filter((id) => !definedIcons.has(id)).join(", "));

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
