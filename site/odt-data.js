/* Reference data for the setup wizard.
 * Product IDs, channels and ExcludeApp IDs follow Microsoft's published ODT
 * documentation (checked October 2026). Plain global script, no modules, so
 * the page also works from file://.
 */
window.ODT = window.ODT || {};

/* Families drive which channels and architectures are legal. */
ODT.families = {
  m365: {
    label: 'Microsoft 365 subscription',
    channels: ['Current', 'MonthlyEnterprise', 'SemiAnnual'],
    defaultChannel: 'Current',
    arch: ['64', '32']
  },
  ltsc2024: {
    label: 'Office LTSC 2024 (volume)',
    channels: ['PerpetualVL2024'],
    defaultChannel: 'PerpetualVL2024',
    arch: ['64']
  },
  ltsc2021: {
    label: 'Office LTSC 2021 (volume)',
    channels: ['PerpetualVL2021'],
    defaultChannel: 'PerpetualVL2021',
    arch: ['64', '32']
  },
  ltsc2019: {
    label: 'Office 2019 (volume)',
    channels: ['PerpetualVL2019'],
    defaultChannel: 'PerpetualVL2019',
    arch: ['64', '32']
  }
};

ODT.channelNames = {
  Current: 'Current Channel',
  MonthlyEnterprise: 'Monthly Enterprise Channel',
  SemiAnnual: 'Semi-Annual Enterprise Channel',
  PerpetualVL2024: 'PerpetualVL2024',
  PerpetualVL2021: 'PerpetualVL2021',
  PerpetualVL2019: 'PerpetualVL2019'
};

/* How each channel should be described. No build numbers are written down here:
 * Microsoft publishes a new one every month, so anything we hard-coded would be
 * stale. The page links to Microsoft's update history instead
 * (ODT.versionInfo.lookupUrl) for anyone who wants to pin one. */
ODT.channelInfo = {
  Current: { note: 'New features as soon as they ship.' },
  MonthlyEnterprise: { note: 'New features once a month.' },
  SemiAnnual: {
    note: 'Same monthly builds as Monthly Enterprise now.'
  },
  PerpetualVL2024: { note: 'Security fixes only; no new features.' },
  PerpetualVL2021: { note: 'Security fixes only; no new features.' },
  PerpetualVL2019: { note: 'Security fixes only; no new features.' }
};

/* Suite products. `addons` lists the Visio/Project IDs that match the family. */
ODT.products = [
  {
    id: 'O365ProPlusRetail',
    name: 'Microsoft 365 Apps for enterprise',
    family: 'm365',
    suite: true,
    group: 'common',
    addons: ['VisioProRetail', 'ProjectProRetail'],
    note: 'Work or school licence. Business Standard/Premium, E3 or E5.'
  },
  {
    id: 'O365BusinessRetail',
    name: 'Microsoft 365 Apps for business',
    family: 'm365',
    suite: true,
    group: 'common',
    addons: ['VisioProRetail', 'ProjectProRetail'],
    note: 'Work or school licence, smaller tenants.'
  },
  {
    id: 'ProPlus2024Volume',
    name: 'Office LTSC Professional Plus 2024',
    family: 'ltsc2024',
    suite: true,
    group: 'volume',
    addons: ['VisioPro2024Volume', 'ProjectPro2024Volume'],
    note: 'KMS or MAK. 64-bit only, security fixes only.'
  },
  {
    id: 'Standard2024Volume',
    name: 'Office LTSC Standard 2024',
    family: 'ltsc2024',
    suite: true,
    group: 'volume',
    addons: ['VisioPro2024Volume', 'ProjectPro2024Volume'],
    note: 'Professional Plus without Access and Publisher.'
  },
  {
    id: 'ProPlus2021Volume',
    name: 'Office LTSC Professional Plus 2021',
    family: 'ltsc2021',
    suite: true,
    group: 'volume',
    addons: ['VisioPro2021Volume', 'ProjectPro2021Volume'],
    note: 'Supported until October 2026.'
  },
  {
    id: 'Standard2021Volume',
    name: 'Office LTSC Standard 2021',
    family: 'ltsc2021',
    suite: true,
    group: 'volume',
    addons: ['VisioPro2021Volume', 'ProjectPro2021Volume'],
    note: 'Without Access and Publisher.'
  },
  {
    id: 'ProPlus2019Volume',
    name: 'Office Professional Plus 2019',
    family: 'ltsc2019',
    suite: true,
    group: 'volume',
    addons: ['VisioPro2019Volume', 'ProjectPro2019Volume'],
    note: 'Older release. Check your agreement.'
  },
  {
    id: 'Standard2019Volume',
    name: 'Office Standard 2019',
    family: 'ltsc2019',
    suite: true,
    group: 'volume',
    addons: ['VisioPro2019Volume', 'ProjectPro2019Volume'],
    note: 'Older release without Access and Publisher.'
  },
  {
    id: 'O365HomePremRetail',
    name: 'Microsoft 365 Family / Personal',
    family: 'm365',
    suite: true,
    group: 'more',
    addons: [],
    note: 'Home subscription.'
  },
  {
    id: 'O365ProPlusEEANoTeamsRetail',
    name: 'Microsoft 365 Apps for enterprise (no Teams, EEA)',
    family: 'm365',
    suite: true,
    group: 'more',
    addons: ['VisioProRetail', 'ProjectProRetail'],
    note: 'EEA variant: no Teams.'
  },
  {
    id: 'O365BusinessEEANoTeamsRetail',
    name: 'Microsoft 365 Apps for business (no Teams, EEA)',
    family: 'm365',
    suite: true,
    group: 'more',
    addons: ['VisioProRetail', 'ProjectProRetail'],
    note: 'Business variant: no Teams.'
  },
  {
    id: 'AccessRuntimeRetail',
    name: 'Microsoft Access Runtime',
    family: 'm365',
    suite: false,
    group: 'more',
    addons: [],
    note: 'Runs Access databases without Access installed.'
  }
];

ODT.addons = [
  { id: 'VisioProRetail', name: 'Visio Professional', family: 'm365' },
  { id: 'ProjectProRetail', name: 'Project Professional', family: 'm365' },
  { id: 'VisioPro2024Volume', name: 'Visio LTSC Professional 2024', family: 'ltsc2024' },
  { id: 'ProjectPro2024Volume', name: 'Project Professional 2024', family: 'ltsc2024' },
  { id: 'VisioPro2021Volume', name: 'Visio LTSC Professional 2021', family: 'ltsc2021' },
  { id: 'ProjectPro2021Volume', name: 'Project Professional 2021', family: 'ltsc2021' },
  { id: 'VisioPro2019Volume', name: 'Visio Professional 2019', family: 'ltsc2019' },
  { id: 'ProjectPro2019Volume', name: 'Project Professional 2019', family: 'ltsc2019' }
];

/* The apps a suite can leave out (ExcludeApp IDs), each with a small pictogram.
 * These are generic symbols - an envelope, a cloud, a grid - not Microsoft's
 * application logos. */
ODT.apps = [
  { id: 'Word', name: 'Word', note: 'Documents', icon: 'i-doc' },
  { id: 'Excel', name: 'Excel', note: 'Spreadsheets', icon: 'i-grid' },
  { id: 'PowerPoint', name: 'PowerPoint', note: 'Slides', icon: 'i-slide' },
  { id: 'Outlook', name: 'Outlook', note: 'Mail and calendar', icon: 'i-mail' },
  { id: 'OneNote', name: 'OneNote', note: 'Notes', icon: 'i-paste-16' },
  { id: 'Access', name: 'Access', note: 'Databases', icon: 'i-db' },
  { id: 'Publisher', name: 'Publisher', note: 'Print layouts', icon: 'i-shapes' },
  { id: 'Teams', name: 'Microsoft Teams', note: 'Chat and meetings', icon: 'i-text-16' },
  { id: 'Groove', name: 'OneDrive for Business', note: 'The old sync client', icon: 'i-align-16' },
  { id: 'OneDrive', name: 'OneDrive desktop', note: 'Office installs this one. Windows ships a copy of its own, and excluding it here does not remove that one.', icon: 'i-align-16' },
  { id: 'Lync', name: 'Skype for Business', note: 'Calls', icon: 'i-hyperlink-16' },
  { id: 'OutlookForWindows', name: 'new Outlook for Windows', note: 'Separate from Outlook', icon: 'i-mail' }
];

/* Languages, most-requested first so the usual pick is near the top. */
ODT.languages = [
  { id: 'en-us', name: 'English' },
  { id: 'af-za', name: 'Afrikaans' },
  { id: 'sq-al', name: 'Albanian' },
  { id: 'ar-sa', name: 'Arabic' },
  { id: 'hy-am', name: 'Armenian' },
  { id: 'as-in', name: 'Assamese' },
  { id: 'az-latn-az', name: 'Azerbaijani (Latin)' },
  { id: 'bn-bd', name: 'Bangla (Bangladesh)' },
  { id: 'bn-in', name: 'Bangla (Bengali India)' },
  { id: 'eu-es', name: 'Basque (Basque)' },
  { id: 'bs-latn-ba', name: 'Bosnian (Latin)' },
  { id: 'bg-bg', name: 'Bulgarian' },
  { id: 'ca-es', name: 'Catalan' },
  { id: 'ca-es-valencia', name: 'Catalan (Valencia)' },
  { id: 'zh-cn', name: 'Chinese (Simplified)' },
  { id: 'zh-tw', name: 'Chinese (Traditional)' },
  { id: 'hr-hr', name: 'Croatian' },
  { id: 'cs-cz', name: 'Czech' },
  { id: 'da-dk', name: 'Danish' },
  { id: 'nl-nl', name: 'Dutch' },
  { id: 'en-gb', name: 'English UK' },
  { id: 'et-ee', name: 'Estonian' },
  { id: 'fi-fi', name: 'Finnish' },
  { id: 'fr-fr', name: 'French' },
  { id: 'fr-ca', name: 'French Canada' },
  { id: 'gl-es', name: 'Galician' },
  { id: 'ka-ge', name: 'Georgian' },
  { id: 'de-de', name: 'German' },
  { id: 'el-gr', name: 'Greek' },
  { id: 'gu-in', name: 'Gujarati' },
  { id: 'ha-latn-ng', name: 'Hausa' },
  { id: 'he-il', name: 'Hebrew' },
  { id: 'hi-in', name: 'Hindi' },
  { id: 'hu-hu', name: 'Hungarian' },
  { id: 'is-is', name: 'Icelandic' },
  { id: 'ig-ng', name: 'Igbo' },
  { id: 'id-id', name: 'Indonesian' },
  { id: 'ga-ie', name: 'Irish' },
  { id: 'xh-za', name: 'isiXhosa' },
  { id: 'zu-za', name: 'isiZulu' },
  { id: 'it-it', name: 'Italian' },
  { id: 'ja-jp', name: 'Japanese' },
  { id: 'kn-in', name: 'Kannada' },
  { id: 'kk-kz', name: 'Kazakh' },
  { id: 'rw-rw', name: 'Kinyarwanda' },
  { id: 'sw-ke', name: 'KiSwahili' },
  { id: 'kok-in', name: 'Konkani' },
  { id: 'ko-kr', name: 'Korean' },
  { id: 'ky-kg', name: 'Kyrgyz' },
  { id: 'lv-lv', name: 'Latvian' },
  { id: 'lt-lt', name: 'Lithuanian' },
  { id: 'lb-lu', name: 'Luxembourgish' },
  { id: 'mk-mk', name: 'Macedonian (North Macedonia)' },
  { id: 'ms-my', name: 'Malay (Latin)' },
  { id: 'ml-in', name: 'Malayalam' },
  { id: 'mt-mt', name: 'Maltese' },
  { id: 'mi-nz', name: 'Maori' },
  { id: 'mr-in', name: 'Marathi' },
  { id: 'ne-np', name: 'Nepali' },
  { id: 'nb-no', name: 'Norwegian Bokmål' },
  { id: 'nn-no', name: 'Norwegian Nynorsk' },
  { id: 'or-in', name: 'Odia' },
  { id: 'ps-af', name: 'Pashto' },
  { id: 'fa-ir', name: 'Persian' },
  { id: 'pl-pl', name: 'Polish' },
  { id: 'pt-pt', name: 'Portuguese (Portugal)' },
  { id: 'pt-br', name: 'Portuguese (Brazil)' },
  { id: 'pa-in', name: 'Punjabi (Gurmukhi)' },
  { id: 'ro-ro', name: 'Romanian' },
  { id: 'rm-ch', name: 'Romansh' },
  { id: 'ru-ru', name: 'Russian' },
  { id: 'gd-gb', name: 'Scottish Gaelic' },
  { id: 'sr-cyrl-rs', name: 'Serbian (Cyrillic, Serbia)' },
  { id: 'sr-latn-rs', name: 'Serbian (Latin, Serbia)' },
  { id: 'sr-cyrl-ba', name: 'Serbian (Cyrillic, Bosnia & Herzegovina)' },
  { id: 'nso-za', name: 'Sesotho sa Leboa' },
  { id: 'tn-za', name: 'Setswana' },
  { id: 'si-lk', name: 'Sinhala' },
  { id: 'sk-sk', name: 'Slovak' },
  { id: 'sl-si', name: 'Slovenian' },
  { id: 'es-es', name: 'Spanish' },
  { id: 'es-mx', name: 'Spanish Mexico' },
  { id: 'sv-se', name: 'Swedish' },
  { id: 'ta-in', name: 'Tamil' },
  { id: 'tt-ru', name: 'Tatar (Cyrillic)' },
  { id: 'te-in', name: 'Telugu' },
  { id: 'th-th', name: 'Thai' },
  { id: 'tr-tr', name: 'Turkish' },
  { id: 'uk-ua', name: 'Ukrainian' },
  { id: 'ur-pk', name: 'Urdu' },
  { id: 'uz-latn-uz', name: 'Uzbek (Latin)' },
  { id: 'vi-vn', name: 'Vietnamese' },
  { id: 'cy-gb', name: 'Welsh' },
  { id: 'wo-sn', name: 'Wolof' },
  { id: 'yo-ng', name: 'Yoruba' }
];

/* Ready-made starting points. Each one is a full set of choices, so applying a
 * preset is "reset, then this" and never depends on what was there before. */
ODT.presets = [
  {
    id: 'hojos-choice',
    name: "Hojo's Choice",
    note: 'Word, Excel and PowerPoint, with Project and Visio.',
    state: {
      product: 'O365ProPlusRetail',
      channel: 'MonthlyEnterprise',
      arch: '64',
      languages: ['en-us'],
      addons: ['VisioProRetail', 'ProjectProRetail'],
      excludeApps: ['Outlook', 'OneNote', 'Access', 'Publisher', 'Teams', 'Groove',
        'OneDrive', 'Lync', 'OutlookForWindows']
    }
  },
  {
    id: 'm365-complete',
    name: 'M365 Apps',
    note: 'Every Office app except the business ones, current channel.',
    state: { product: 'O365ProPlusRetail', channel: 'Current', arch: '64', languages: ['en-us'],
      excludeApps: ['Teams', 'Groove', 'OneDrive', 'Lync', 'OutlookForWindows'] }
  },
  {
    id: 'm365-complete-addons',
    name: 'M365 Apps + Project & Visio',
    note: 'Every Office app except the business ones, plus Project and Visio.',
    state: { product: 'O365ProPlusRetail', channel: 'Current', arch: '64', languages: ['en-us'],
      addons: ['VisioProRetail', 'ProjectProRetail'], excludeApps: ['Teams', 'Groove', 'OneDrive', 'Lync', 'OutlookForWindows'] }
  },
  {
    id: 'ltsc-2024',
    name: 'LTSC ProPlus 2024',
    note: 'Every Office app except the business ones, fixed release, 64-bit only.',
    state: { product: 'ProPlus2024Volume', arch: '64', languages: ['en-us'], removeMsi: true,
      excludeApps: ['Teams', 'Groove', 'OneDrive', 'Lync', 'OutlookForWindows'] }
  }
];

ODT.productMap = {};
ODT.products.forEach(function (p) { ODT.productMap[p.id] = p; });

ODT.addonMap = {};
ODT.addons.forEach(function (a) { ODT.addonMap[a.id] = a; });

ODT.languageMap = {};
/* The languages most deployments pick, shown as their own group at the top of
 * the picker. Everything else follows in Microsoft's own order. */
ODT.commonLanguages = [
  'en-us', 'en-gb', 'de-de', 'fr-fr', 'es-es', 'it-it', 'pt-br', 'nl-nl', 'pl-pl',
  'ru-ru', 'sv-se', 'da-dk', 'nb-no', 'fi-fi', 'cs-cz', 'tr-tr', 'ja-jp', 'ko-kr',
  'zh-cn', 'zh-tw'
];

ODT.languages.forEach(function (l) { ODT.languageMap[l.id] = l; });

ODT.appMap = {};
ODT.apps.forEach(function (a) { ODT.appMap[a.id] = a; });

/* Icon per product. */
ODT.productInfo = {
  O365ProPlusRetail: { icon: 'i-navigator-16' },
  O365BusinessRetail: { icon: 'i-navigator-16' },
  O365HomePremRetail: { icon: 'i-help-16' },
  O365ProPlusEEANoTeamsRetail: { icon: 'i-help-16' },
  O365BusinessEEANoTeamsRetail: { icon: 'i-help-16' },
  ProPlus2024Volume: { icon: 'i-plugin-16' },
  Standard2024Volume: { icon: 'i-plugin-16' },
  ProPlus2021Volume: { icon: 'i-plugin-16' },
  Standard2021Volume: { icon: 'i-plugin-16' },
  ProPlus2019Volume: { icon: 'i-plugin-16' },
  Standard2019Volume: { icon: 'i-plugin-16' },
  AccessRuntimeRetail: { icon: 'i-help-16' }
};

ODT.addonInfo = {
  VisioProRetail: { icon: 'i-shapes' },
  ProjectProRetail: { icon: 'i-chart' },
  VisioPro2024Volume: { icon: 'i-shapes' },
  ProjectPro2024Volume: { icon: 'i-chart' },
  VisioPro2021Volume: { icon: 'i-shapes' },
  ProjectPro2021Volume: { icon: 'i-chart' },
  VisioPro2019Volume: { icon: 'i-shapes' },
  ProjectPro2019Volume: { icon: 'i-chart' }
};

/* Where to look up the current build number for a channel. We deliberately do
 * not bake versions in: they change monthly and stale data is worse than none. */
ODT.versionInfo = {
  pattern: '16.0.XXXXX.YYYYY',
  matchInstalled: 'MatchInstalled',
  lookupUrl: 'https://learn.microsoft.com/en-us/officeupdates/update-history-microsoft365-apps-by-date',
  lookupLabel: "Microsoft's update history"
};
