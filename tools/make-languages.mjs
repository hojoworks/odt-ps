/* Rebuild ODT.languages from Microsoft's own supported-language table, so the
 * pick list really is complete and the "other culture code" box is redundant.
 *
 *   node tools/make-languages.mjs
 *
 * Source: "Overview of deploying languages for Microsoft 365 Apps" on
 * Microsoft Learn. The page lists language, culture code and companion
 * proofing languages; we take the first two and lower-case the codes, because
 * that is the form the ODT expects in configuration.xml.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "https://learn.microsoft.com/en-us/microsoft-365-apps/deploy/" +
  "overview-deploying-languages-microsoft-365-apps";

const response = await fetch(SOURCE, {
  headers: { "user-agent": "odt-ps/1.0 (+https://github.com/hojoworks/odt-ps)" }
});
if (!response.ok) { throw new Error("could not fetch the language table: " + response.status); }
const html = await response.text();

/* the table rows are plain <td>name</td><td>ll-CC</td><td>proofing…</td> */
const languages = [];
for (const row of html.split(/<tr[\s>]/).slice(1)) {
  const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) =>
    cell[1]
      .replace(/<sup[\s\S]*?<\/sup>/g, "")          /* footnote markers */
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#x?[0-9a-fA-F]+;/g, "")
      .replace(/\s*\^\^?\d\^\^?\s*$/, "")
      .replace(/\s+/g, " ").trim());
  if (cells.length < 2) { continue; }
  const name = cells[0];
  const code = cells[1];
  if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]+)+$/.test(code)) { continue; }
  languages.push({ id: code.toLowerCase(), name: name });
}

if (languages.length < 80) {
  throw new Error("only found " + languages.length + " languages in the table, refusing to write");
}

/* English (United States) stays first: it is the default, so it should be
   visible without scrolling. Everything else is in Microsoft's order. */
const first = languages.findIndex((language) => language.id === "en-us");
if (first > 0) { languages.unshift(languages.splice(first, 1)[0]); }

const block = "ODT.languages = [\n" +
  languages.map((language) => "  { id: '" + language.id + "', name: '" + language.name.replace(/'/g, "\\'") + "' }").join(",\n") +
  "\n];";

const dataPath = join(root, "site", "odt-data.js");
const data = readFileSync(dataPath, "utf8");
const pattern = /ODT\.languages = \[[\s\S]*?\n\];/;
if (!pattern.test(data)) { throw new Error("ODT.languages block not found"); }
writeFileSync(dataPath, data.replace(pattern, block));

console.log("wrote " + languages.length + " languages, first: " +
  languages[0].id + ", last: " + languages[languages.length - 1].id);
console.log("codes are all lower-case: " + languages.every((l) => l.id === l.id.toLowerCase()));
