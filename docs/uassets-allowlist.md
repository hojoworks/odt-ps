# uBlock Origin allowlist request (ClickFix false positive)

Status: **prepared, not yet submitted**. Posting it needs a GitHub account.

## The problem

uBlock Origin ships a scriptlet, `prevent-clipboard-write`, that stops any page outside its allowlist from
putting shell-like text on the clipboard (the ClickFix attack pattern). It shows a DOM alert naming the
blocked text.

* Filter: `filters-general.txt`, the `prevent-clipboard-write` rule in the ClickFix section.
* Our one-liner matches one of its alternatives: `^\(?irm .+?\biex\b`.
* Result: clicking **Copy** on <https://hojoworks.github.io/odt-ps/> shows
  *“Beware, uBlock Origin blocked a potential ClickFix attack: irm https://hojoworks.github.io/odt-ps/get.ps1 | iex”*.

The page also offers a download, so nobody is stuck. The clipboard block is still a false positive for a tool
that legitimately hands users one command.

## Precedent

The same thing happened to runpane.com: the owner opened
[uAssets discussion #34645, “ClickFix false block”](https://github.com/uBlockOrigin/uAssets/discussions/34645)
and was added to the exception list. That line now reads:

```
astral.sh,brew.sh,christitus.com,community-scripts.org,datadoghq.*,devaccellabs.com,jetbrains.com,massgrave.dev,natfrp.com,ntriver.org,runpane.com#@#+js(prevent-clipboard-write, …)
```

## Request

Add `hojoworks.github.io` to that domain list (alphabetically, after `devaccellabs.com`).

Why this is a false positive:

* **Deployment tool, not an activator.** It installs Microsoft Office using Microsoft's own Office Deployment
  Tool. No activation code, no keys, no KMS emulation, no patching.
* **Readable by design.** Both scripts are plain ASCII text, about 70 KB, no obfuscation, no encoded commands,
  no `-w hidden`, no `ExecutionPolicy Bypass`. They are published next to their SHA-256 hashes
  (`SHA256SUMS`) and every historical change is public in the repository.
* **Nothing is bundled.** The Office Deployment Tool and the Office files come from Microsoft URLs at run time;
  the scripts contact nothing else, and send no telemetry.
* **The command is the documented path,** and the page additionally offers a download for people who would
  rather not paste anything, so nobody is pushed into the Clipboard.

## Where to post

Open a discussion at <https://github.com/uBlockOrigin/uAssets/discussions>, reference discussion #34645, and
include a screenshot of the alert.

## What is already implemented on our side

* The landing page leads with a **download** option, so the block never prevents an installation.
* The **Copy** buttons detect a hooked clipboard API and fall back to selecting the text with a “Press Ctrl+C”
  prompt, because uBlock intercepts programmatic writes but not the user's own keystroke.
* The FAQ on the page explains the mechanism and links here instead of asking visitors to disable anything.
