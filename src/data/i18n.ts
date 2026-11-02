/**
 * Session 10 P4 (issue #19, ROADMAP v4 item 9): i18n — the copy modules.
 *
 * ONE copy table per locale (the existing copy-module pattern: every
 * user-facing string lives in src/data/, never hardcoded in components).
 * Slovenian first — the deployed meadow greets its actual audience.
 *
 * Facts themselves (PLANT_FACTS / structure facts / milestones' detail /
 * visitor facts) stay in their existing data modules and are translated via
 * the `fact` override tables below, keyed by the fact id — the EDUCATION.md
 * source-of-truth rule is unchanged: translations are phrasings of the same
 * verified facts, never new facts.
 *
 * Key-set parity between locales is asserted by a unit check — no
 * missing-key fallbacks are ever visible to the user.
 */
import type { Season } from './seasons';

export type Locale = 'en' | 'sl';

export const LOCALES: Locale[] = ['en', 'sl'];
export const DEFAULT_LOCALE: Locale = 'en';

/** browser-locale default: Slovenian when the browser speaks Slovenian */
export function localeFromBrowser(nav: { language?: string; languages?: readonly string[] }): Locale {
  const langs = [...(nav.languages ?? []), nav.language ?? ''].map((l) => l.toLowerCase());
  return langs.some((l) => l.startsWith('sl')) ? 'sl' : 'en';
}

export interface UiCopy {
  /** corner controls (tooltips, labels) */
  audioOn: string;
  audioOff: string;
  audioMuteTitle: string;
  audioListenTitle: string;
  magnifierTitle: string;
  helpTitle: string;
  notebookTitle: string;
  postcardTitle: string;
  seedShareTitle: string;
  seedShareHeading: string;
  seedShareCopied: string;
  seedShareHint: string;
  seedButton: string;
  seedCopiedButton: string;
  /** palette */
  palettePlantingTitle: string;
  palettePlantingLabel: string;
  paletteEquipmentTitle: string;
  paletteEquipmentLabel: string;
  naturalPlacement: string;
  on: string;
  off: string;
  /** season dial */
  pauseTip: string;
  jumpMorningTip: string;
  /** toasts */
  toastSeasonDriftsIn: string;
  toastGardenRecipe: string;
  toastMeadowSeedsItself: string;
  toastFirstBloom: string;
  toastWingsInAir: string;
  toastPieceCameBack: (n: number) => string;
  toastTooCloseTitle: string;
  toastTooCloseBody: string;
  /** reset dialog */
  resetButtonTitle: string;
  resetDialogTitle: string;
  resetDialogBody: string;
  resetOrSeedHeading: string;
  resetSeedPlaceholder: string;
  resetSeedStart: string;
  resetSeedError: string;
  resetCancel: string;
  resetConfirm: string;
  /** onboarding + nudges */
  onbPlantTitle: string;
  onbPlantBody: string;
  onbHoverTitle: string;
  onbHoverBody: string;
  onbReturnTitle: string;
  onbReturnBody: string;
  nudgeAliveTitle: string;
  nudgeAliveBody: string;
  nudgeGlassTitle: string;
  nudgeGlassBody: string;
  nudgeSeasonsTitle: string;
  nudgeSeasonsBody: string;
  /** notebook hub */
  hubTitle: string;
  hubLearnedFacts: string;
  hubFirstSightings: string;
  hubWildVisitors: string;
  hubRecipes: string;
  hubMilestones: string;
  hubMilestoneWaiting: string;
  hubFactsEmpty: string;
  hubSightingsEmpty: string;
  hubRecipeUndiscovered: string;
  hubRecipeHint: string;
  hubFireflyLabel: string;
  hubFireflyFact: string;
  hubNotebookTitle: string;
  hubNotebookHint: string;
  notebookSeenBadge: string;
  /** magnifier card */
  cardInBloomNow: string;
  cardRestingThisSeason: string;
  cardVisitorTitle: string;
  cardVisitorText: string;
  cardFlowerFallback: string;
  /** hive popup / honey */
  hiveFallbackName: string;
  hiveCombFull: string;
  hiveCombFilling: string;
  hiveCombSettling: string;
  /** shortcuts hint panel */
  shortcutsTitle: string;
  shortcutsGroupCamera: string;
  shortcutsGroupTools: string;
  shortcutsGroupCancel: string;
  shortcutsMoveCamera: string;
  shortcutsTurnView: string;
  shortcutsGlass: string;
  shortcutsJournal: string;
  shortcutsStartOver: string;
  shortcutsCloseOpen: string;
  shortcutsPanelTitle: string;
  /** postcard stats */
  statNaturePlanted: string;
  statBeeCarePutUp: string;
  statBeesAbout: string;
  statSeasonsPassed: string;
  statJarsOfHoney: string;
  /** #67: postcard facts-learned stat + seed stamp microcopy */
  statFactsLearned: string;
  postcardSeedStamp: string;
  postcardSaved: string;
  postcardButton: string;
  /** misc */
  flowerFallback: string;
  recipeFallback: string;
  meadowTitle: string;
  toastLovely: string;
  languageName: Record<Locale, string>;
  /** season-name helper consumers: one source for every rendered season name */
  seasonName: (s: Season) => string;
  bloomRarely: string;
  bloomAllYear: string;
  bloomIn: string;
  statusPlace: string;
  statusWander: string;
  notebookInBloomNow: string;
  notebookQuietWinter: string;
  cardVisitedIn: string;
  cardFirstSighting: string;
  hubGuestBook: string;
  hiveMore: string;
  hiveJarLine: (n: number) => string;
  combFull: string;
  combFilling: string;
  combSettling: string;
  colonyWinter: string;
  colonySpring: string;
  colonySummer: string;
  colonyAutumn: string;
  speedTip: (s: number) => string;
  statOneFlower: string;
  statNoneYet: string;
  statQuietSkies: string;
  statDialNotTurned: string;
  statCombFilling: string;
}

const en: UiCopy = {
  audioOn: '\u{1F507} Sound on',
  audioOff: '\u{1F50A} Sound off',
  audioMuteTitle: 'Mute the meadow',
  audioListenTitle: 'Listen to the meadow',
  magnifierTitle: 'Magnifying glass — hover a flower or a visitor for a close read',
  helpTitle: 'How to play',
  postcardTitle: 'Save a postcard of your meadow',
  seedShareTitle: "Share this meadow's seed — a friend grows the same layout from it",
  seedShareHeading: "Share this meadow's seed",
  seedShareCopied: 'Copied — send it to a friend.',
  seedShareHint: 'Click the code to select it, then copy.',
  seedButton: '\u{1F331} Seed',
  seedCopiedButton: 'copied ✓',
  palettePlantingTitle: 'Flowers & nature — grouped by bloom season',
  palettePlantingLabel: '\u{1F33F} Planting',
  paletteEquipmentTitle: 'Bee housing & care',
  paletteEquipmentLabel: '\u{1F41D} Equipment',
  naturalPlacement: 'Natural placement',
  on: 'ON',
  off: 'OFF',
  pauseTip: 'Let the meadow hold still a moment (resumes naturally on your next visit)',
  jumpMorningTip: 'A new spring morning (starts spring; the calendar keeps drifting)',
  toastSeasonDriftsIn: 'A season drifts in',
  toastGardenRecipe: 'A garden recipe!',
  toastMeadowSeedsItself: 'The meadow seeds itself',
  toastFirstBloom: 'The first bloom',
  toastWingsInAir: 'Wings in the air',
  toastPieceCameBack: (n: number) => `${n} piece${n === 1 ? '' : 's'} of the meadow came back from the saved blob.`,
  toastTooCloseTitle: 'Too close to remove safely',
  toastTooCloseBody: 'Zoom out a little first — right-click removes work best with the meadow in view.',
  resetButtonTitle: 'Start the meadow over',
  resetDialogTitle: 'Reset your meadow?',
  resetDialogBody: 'All placed flowers, structures, progress and milestones will be deleted. This cannot be undone.',
  resetOrSeedHeading: "Or start from a friend's seed:",
  resetSeedPlaceholder: 'ML1.……',
  resetSeedStart: 'Grow theirs',
  resetSeedError: "That seed doesn't read — nothing was changed, your meadow is safe.",
  resetCancel: 'Cancel',
  resetConfirm: 'Reset',
  onbPlantTitle: '\u{1F33C} Plant a flower',
  onbPlantBody: 'Pick any flower from the palette below and click the meadow to plant it. There is no wrong spot — winding drifts look best.',
  onbHoverTitle: '\u{1F50D} Hover it to learn',
  onbHoverBody: 'Arm the magnifying glass in the corner and hover any flower, hive, or bee for a close read — your field notebook shares a real fact.',
  onbReturnTitle: '\u{1F307} Come back tomorrow',
  onbReturnBody: 'The meadow grows on its own while you are away. Turn the season dial, keep bees happy, and check back for milestones.',
  nudgeAliveTitle: 'Your meadow is already alive',
  nudgeAliveBody: 'A hive hums and the flowers are open — the bees found them on their own. Plant more from the palette below whenever you like.',
  nudgeGlassTitle: 'Try the magnifying glass',
  nudgeGlassBody: 'The glass in the corner zooms in on anything living — hover a flower or a bee with it armed for a close read.',
  nudgeSeasonsTitle: 'The seasons turn on their own',
  nudgeSeasonsBody: 'Turn the dial in the corner to visit another season — what blooms changes, and the meadow remembers what you have seen.',
  hubTitle: 'Field Notebook',
  hubLearnedFacts: 'LEARNED FACTS',
  hubFirstSightings: 'FIRST SIGHTINGS',
  hubWildVisitors: 'WILD VISITORS',
  hubRecipes: 'GARDEN RECIPES',
  hubMilestones: 'MILESTONES',
  hubMilestoneWaiting: 'still waiting in the meadow…',
  hubFactsEmpty: 'Nothing yet — arm the magnifying glass and hover a flower, hive, or bee; its fact lands here. \u{1F50D}',
  hubSightingsEmpty: '\u{1F412} Nothing yet — arm the glass and hover anything living.',
  hubRecipeUndiscovered: 'A recipe, still undiscovered',
  hubRecipeHint: ' — two flowers that grow happily together…',
  hubFireflyLabel: 'Fireflies',
  hubFireflyFact: 'On summer evenings the meadow glows — fireflies drift over the wild corners while the hive sleeps.',
  hubNotebookTitle: 'Field notebook (J)',
  hubNotebookHint: 'Field notebook (J)',
  notebookTitle: 'The Meadow',
  notebookSeenBadge: "You've read this one before",
  cardInBloomNow: 'In bloom now',
  cardRestingThisSeason: 'Resting this season',
  cardVisitorTitle: 'Visitor',
  cardVisitorText: 'A wild visitor, passing through the meadow.',
  cardFlowerFallback: 'A meadow flower.',
  hiveFallbackName: 'Hive',
  hiveCombFull: 'The comb is full and heavy — golden to the brim. \u{1F36B}',
  hiveCombFilling: 'The comb is filling — you can see it warming through the straw.',
  hiveCombSettling: 'The colony is settling in; the first drops of the season are already in the comb.',
  shortcutsTitle: 'Keyboard',
  shortcutsGroupCamera: 'Camera',
  shortcutsGroupTools: 'Tools',
  shortcutsGroupCancel: 'Cancel',
  shortcutsMoveCamera: 'move the camera',
  shortcutsTurnView: 'turn the view',
  shortcutsGlass: 'magnifying glass',
  shortcutsJournal: 'journal',
  shortcutsStartOver: 'start over (asks first)',
  shortcutsCloseOpen: 'close whatever is open',
  shortcutsPanelTitle: 'Keyboard shortcuts',
  statNaturePlanted: 'Nature planted',
  statBeeCarePutUp: 'Bee care put up',
  statBeesAbout: 'Bees about',
  statSeasonsPassed: 'Seasons passed',
  statJarsOfHoney: 'Jars of honey brought in',
  statFactsLearned: 'Facts learned',
  postcardSeedStamp: 'meadow seed',
  postcardSaved: 'saved ✓',
  postcardButton: '\u{1F4F8} Postcard',
  flowerFallback: 'Flower',
  recipeFallback: 'A recipe, still undiscovered',
  meadowTitle: 'The Meadow',
  toastLovely: 'lovely',
  seasonName: (s) => SEASON_COPY.en[s].label,
  bloomRarely: 'blooms rarely — keep tending',
  bloomAllYear: 'in bloom all year',
  bloomIn: 'in bloom: ',
  statusPlace: 'click the meadow to place',
  statusWander: 'pick something to plant, or just wander',
  notebookInBloomNow: 'In bloom now: ',
  notebookQuietWinter: 'A quiet winter — the bees rest.',
  cardVisitedIn: 'recorded in the notebook — visited in ',
  cardFirstSighting: 'a first sighting — the notebook will remember it',
  hubGuestBook: 'Who stopped by, and when — the meadow keeps its own guest book.',
  hiveMore: 'more about the hive',
  hiveJarLine: (n) => `${n} jar${n === 1 ? '' : 's'} of honey brought in so far`,
  combFull: 'The comb is full and heavy — golden to the brim. \u{1F36B}',
  combFilling: 'The comb is filling — you can see it warming through the straw.',
  combSettling: 'The colony is settling in; the first drops of the season are already in the comb.',
  colonyWinter: 'The colony is tucked in for winter — clustered snug around the queen, shivering together to keep her at a cozy 21°C, feeding on stored honey. \u2744\uFE0F',
  colonySpring: 'The colony is waking with the year — the first foragers stretch their wings among the earliest blooms.',
  colonySummer: 'The colony is at its fullest — the summer hum at its gentle peak.',
  colonyAutumn: 'The colony is easing toward autumn — a few late foragers keep the table, gathering the last warmth.',
  speedTip: (s) => `Let time drift ${s}x faster${s === 8 ? ' — a night passes in about a minute and a half' : ''}`,
  statOneFlower: 'one flower — every meadow starts here',
  statNoneYet: 'none yet — the meadow manages on its own',
  statQuietSkies: 'quiet skies — bees come with blooms',
  statDialNotTurned: 'the dial has not turned yet',
  statCombFilling: 'the comb is still filling',
  languageName: { en: 'English', sl: 'Slovenšina' },
};

const sl: UiCopy = {
  audioOn: '\u{1F507} Zvok vklopljen',
  audioOff: '\u{1F50A} Zvok izklopljen',
  audioMuteTitle: 'Utišaj travnik',
  audioListenTitle: 'Poslušaj travnik',
  magnifierTitle: 'Povečevalno steklo — premiš bagnjico nad rožo ali obiskovalcem za natančen pogled',
  helpTitle: 'Kako igrati',
  postcardTitle: 'Shrani razglednico svojega travnika',
  seedShareTitle: 'Deli semen tega travnika — prijatelj iz njega zraste enako razporeditev',
  seedShareHeading: 'Deli semen tega travnika',
  seedShareCopied: 'Kopirano — pošlji prijatelju.',
  seedShareHint: 'Klikni kodo, da jo izbereš, nato kopiraj.',
  seedButton: '\u{1F331} Seme',
  seedCopiedButton: 'kopirano ✓',
  palettePlantingTitle: 'Rože in narava — razvrščene po sezoni cvetenja',
  palettePlantingLabel: '\u{1F33F} Sajenje',
  paletteEquipmentTitle: 'Čebelnjak in skrb za čebele',
  paletteEquipmentLabel: '\u{1F41D} Oprema',
  naturalPlacement: 'Naravna postavitev',
  on: 'VKLOPLJENO',
  off: 'IZKLOPLJENO',
  pauseTip: 'Pusti travnik miren trenutek (nadaljuje se sam ob naslednjem obisku)',
  jumpMorningTip: 'Novo pomladno jutro (začne pomlad; koledar se še naprej premika)',
  toastSeasonDriftsIn: 'Priplula je nova sezona',
  toastGardenRecipe: 'Vrtni recept!',
  toastMeadowSeedsItself: 'Travnik se sam zaseje',
  toastFirstBloom: 'Prvi cvet',
  toastWingsInAir: 'Krila v zraku',
  toastPieceCameBack: (n: number) => `${n === 1 ? 'Del' : n <= 4 ? `${n} deli` : `${n} delov`} travnika se je vrnil iz shranjenega stanja.`,
  toastTooCloseTitle: 'Preblizu za varno odstranitev',
  toastTooCloseBody: 'Najprej malo oddalji — desni klik najbolje deluje, ko je travnik v vidnem polju.',
  resetButtonTitle: 'Začni travnik znova',
  resetDialogTitle: 'Ponastaviš svoj travnik?',
  resetDialogBody: 'Vse postavljene rože, strukture, napredek in mejniki bodo izbrisani. Tega ni mogoče razveljaviti.',
  resetOrSeedHeading: 'Ali začni iz semena prijatelja:',
  resetSeedPlaceholder: 'ML1.……',
  resetSeedStart: 'Zraste naj tisto',
  resetSeedError: 'To seme se ne prebere — nič se ni spremenilo, tvoj travnik je varen.',
  resetCancel: 'Prekliči',
  resetConfirm: 'Ponastavi',
  onbPlantTitle: '\u{1F33C} Zasadi rožo',
  onbPlantBody: 'Izberi katerokoli rožo iz palete spodaj in klikni travnik, da jo zasadiš. Ni napačnega mesta — vijugaste poti so najlepše.',
  onbHoverTitle: '\u{1F50D} Premakni nanjo, da se naučiš',
  onbHoverBody: 'Vključi povečevalno steklo v kotu in premiš bagnjico nad katerokoli rožo, panjem ali čebelo za natančen pogled — tvoj terenski dnevnik deli pravo dejstvo.',
  onbReturnTitle: '\u{1F307} Pridi jutri nazaj',
  onbReturnBody: 'Travnik raste sam, dokler te ni. Zavrti sezonski gumb, poskrbi za srečne čebele in poglej mejnike.',
  nudgeAliveTitle: 'Tvoj travnik je že živ',
  nudgeAliveBody: 'Panj brenči in rože so odprte — čebele so jih našle same. Zasadi še več iz palete spodaj, kadar želiš.',
  nudgeGlassTitle: 'Preizkusi povečevalno steklo',
  nudgeGlassBody: 'Steklo v kotu poveča karkoli živega — premiš bagnjico nad rožo ali čebelo z vklopljenim steklom za natančen pogled.',
  nudgeSeasonsTitle: 'Sezone se vrtijo same',
  nudgeSeasonsBody: 'Zavrti gumb v kotu, da obiščeš drugo sezono — kaj cveti se spremeni, travnik pa si zapomni, kaj si videl.',
  hubTitle: 'Terenski dnevnik',
  hubLearnedFacts: 'SPOZNANA DEJSTVA',
  hubFirstSightings: 'PRVA VIDENJA',
  hubWildVisitors: 'DIVJI OBISKOVALCI',
  hubRecipes: 'VRTNI RECEPTI',
  hubMilestones: 'MEJNIKI',
  hubMilestoneWaiting: 'še čaka na travniku…',
  hubFactsEmpty: 'Še nič — vključi povečevalno steklo in premiš bagnjico nad rožo, panj ali čebelo; njeno dejstvo se pojavi tukaj. \u{1F50D}',
  hubSightingsEmpty: '\u{1F412} Še nič — vključi steklo in premiš bagnjico nad karkoli živim.',
  hubRecipeUndiscovered: 'Recept, še neodkrit',
  hubRecipeHint: ' — dve roži, ki skupaj lepo rasteta…',
  hubFireflyLabel: 'Kresničke',
  hubFireflyFact: 'Poletne večere travnik žari — kresničke lebdejo nad divjimi kotiči, medtem ko panj spi.',
  hubNotebookTitle: 'Terenski dnevnik (J)',
  hubNotebookHint: 'Terenski dnevnik (J)',
  notebookTitle: 'Travnik',
  notebookSeenBadge: 'To si že prebral',
  cardInBloomNow: 'Zdaj cveti',
  cardRestingThisSeason: 'Tokrat počiva',
  cardVisitorTitle: 'Obiskovalec',
  cardVisitorText: 'Divji obiskovalec, ki se sprehaja čez travnik.',
  cardFlowerFallback: 'Travniška roža.',
  hiveFallbackName: 'Panj',
  hiveCombFull: 'Sato je polno in težko — zlato do vrha. \u{1F36B}',
  hiveCombFilling: 'Sato se polni — skozi slamo se vidi, kako se greje.',
  hiveCombSettling: 'Družina se vseljuje; prve kapljice sezone so že v satih.',
  shortcutsTitle: 'Tipkovnica',
  shortcutsGroupCamera: 'Kamera',
  shortcutsGroupTools: 'Orodja',
  shortcutsGroupCancel: 'Prekliči',
  shortcutsMoveCamera: 'premakni kamero',
  shortcutsTurnView: 'zavrti pogled',
  shortcutsGlass: 'povečevalno steklo',
  shortcutsJournal: 'dnevnik',
  shortcutsStartOver: 'začni znova (vpraša najprej)',
  shortcutsCloseOpen: 'zapre, kar je odprto',
  shortcutsPanelTitle: 'Bližnjice na tipkovnici',
  statNaturePlanted: 'Posajene rastline',
  statBeeCarePutUp: 'Postavljena skrb za čebele',
  statBeesAbout: 'Čebele naokoli',
  statSeasonsPassed: 'Pretekle sezone',
  statJarsOfHoney: 'Prineseni kozarci medu',
  statFactsLearned: 'Naučena dejstva',
  postcardSeedStamp: 'seme travnika',
  postcardSaved: 'shranjeno ✓',
  postcardButton: '\u{1F4F8} Razglednica',
  flowerFallback: 'Roža',
  recipeFallback: 'Recept, še neodkrit',
  meadowTitle: 'Travnik',
  toastLovely: 'čudovito',
  seasonName: (s) => SEASON_COPY.sl[s].label,
  bloomRarely: 'redko cveti — samo neguj jo',
  bloomAllYear: 'cveti vse leto',
  bloomIn: 'cveti: ',
  statusPlace: 'klikni travnik, da postaviš',
  statusWander: 'izberi kaj za posaditi, ali pa samo poglej okoli',
  notebookInBloomNow: 'Zdaj cveti: ',
  notebookQuietWinter: 'Tiha zima — čebele počivajo.',
  cardVisitedIn: 'zapisano v dnevnik — obiskano v ',
  cardFirstSighting: 'prvo videnje — dnevnik si bo zapomnil',
  hubGuestBook: 'Kdo se je ustavil in kdaj — travnik vodi svojo knjigo gostov.',
  hiveMore: 'več o panju',
  hiveJarLine: (n) => `${n} ${n === 1 ? 'kozarec' : n <= 4 ? `${n} kozarci` : `${n} kozarcev`} medu prinesenega doslej`,
  combFull: 'Sato je polno in težko — zlato do vrha. \u{1F36B}',
  combFilling: 'Sato se polni — skozi slamo se vidi, kako se greje.',
  combSettling: 'Družina se vseljuje; prve kapljice sezone so že v satih.',
  colonyWinter: 'Družina je sklenjena za zimo — stisnjena okoli matice, skupaj drgetajo, da jo ogrejejo na prijetnih 21°C, in se hranijo z zalogo medu. \u2744\uFE0F',
  colonySpring: 'Družina se prebuja z letom — prvi nabiralci raztegnejo krila med najzgodnejšimi cvetovi.',
  colonySummer: 'Družina je na vrhuncu — poletni brenč na svojem nežnem vrhu.',
  colonyAutumn: 'Družina se počasi spušča v jesen — nekaj poznih nabiralcev še skrbi za mizo in nabira zadnjo toploto.',
  speedTip: (s) => `Pusti čas teči ${s}x hitreje${s === 8 ? ' — noč mine v približno minuti in pol' : ''}`,
  statOneFlower: 'ena roža — vsak travnik se začne tukaj',
  statNoneYet: 'še nič — travnik se sam zna',
  statQuietSkies: 'tiho nebo — čebele pridejo s cvetovi',
  statDialNotTurned: 'gumb se še ni zavrtel',
  statCombFilling: 'sato se še polni',
  languageName: { en: 'English', sl: 'Slovenšina' },
};

export const UI_COPY: Record<Locale, UiCopy> = { en, sl };

/** season labels + arrival lines + dial tips (were in data/seasons.ts) */
export const SEASON_COPY: Record<Locale, Record<Season, { label: string; arrival: string; tip: string }>> = {
  en: {
    spring: { label: 'Spring', arrival: 'The meadow turns to spring — early blooms wake the queens.', tip: 'Early blooms wake the queens — crocuses, thyme and forget-me-nots lead.' },
    summer: { label: 'Summer', arrival: 'The meadow turns to summer — lavender and borage hum before you see them.', tip: 'Peak forage — lavender and borage hum before you see them.' },
    autumn: { label: 'Autumn', arrival: 'The meadow turns to autumn — asters keep the table set late.', tip: 'Late bloom — asters keep the table set.' },
    winter: { label: 'Winter', arrival: 'The meadow settles into winter — the hive clusters, cozy and quiet.', tip: 'Quiet days — crocuses open early for the first brave foragers.' },
  },
  sl: {
    spring: { label: 'Pomlad', arrival: 'Travnik se spremeni v pomlad — zgodnji cvetovi zbudijo matice.', tip: 'Zgodnji cvetovi zbudijo matice — žafran, timijan in spomladanska lilija vodijo.' },
    summer: { label: 'Poletje', arrival: 'Travnik se spremeni v poletje — sivka in boreč brenčita, preden ju vidiš.', tip: 'Vrh sezone — sivka in boreč brenčita, preden ju vidiš.' },
    autumn: { label: 'Jesen', arrival: 'Travnik se spremeni v jesen — asterji držijo mizo postavljeno pozno.', tip: 'Pozni cvet — asterji držijo mizo postavljeno.' },
    winter: { label: 'Zima', arrival: 'Travnik se umiri v zimo — panj se stisne, prijetno in tiho.', tip: 'Tihi dnevi — žafran se zgodaj odpre za prve pogumne nabiralce.' },
  },
};

/** plant + structure names (were in data/plants.ts / structures.ts) */
export const PLANT_NAME_COPY: Record<Locale, Record<string, string>> = {
  en: {
    lavender: 'Lavender', clover: 'Clover', poppy: 'Wild Poppy', sunflower: 'Sunflower',
    thyme: 'Wild Thyme', crocus: 'Crocus', borage: 'Borage', cosmos: 'Cosmos',
    aster: 'Aster', 'forget-me-not': 'Forget-me-not',
  },
  sl: {
    lavender: 'Sivka', clover: 'Detelja', poppy: 'Divji mak', sunflower: 'Sončnica',
    thyme: 'Divji timijan', crocus: 'Žafran', borage: 'Boreč', cosmos: 'Kozmos',
    aster: 'Aster', 'forget-me-not': 'Spomladanska lilija',
  },
};

export const STRUCTURE_NAME_COPY: Record<Locale, Record<string, string>> = {
  en: { hive: 'Skep Hive', bath: 'Bee Bath', hotel: 'Bee Hotel', hedge: 'Hedge', bush: 'Berry Bush', wildcorner: 'Wild Corner', path: 'Path' },
  sl: { hive: 'Slamnati panj', bath: 'Čebelja kopel', hotel: 'Čebelji hotel', hedge: 'Živa meja', bush: 'Grmičevje', wildcorner: 'Divji kotiček', path: 'Potka' },
};

/** milestone + recipe labels (keyed by the real ids in data/milestones.ts / recipes.ts) */
export const MILESTONE_LABEL_COPY: Record<Locale, Record<string, string>> = {
  en: {
    firstFlower: 'The first bloom', firstSwarm: 'Wings in the air', fiveSpecies: 'A varied buffet',
    beeBath: 'Bee bath placed', firstHive: 'The hive hums', tenSpecies: 'Room for everyone',
    hedgesUnlocked: 'Sheltered lanes', yearRoundBloom: 'No feast, no famine', hotelGuests: 'Room 1 is occupied',
    rarePollinator: 'A rare visitor', wildYearSurvived: 'The corner lived a full year',
  },
  sl: {
    firstFlower: 'Prvi cvet', firstSwarm: 'Krila v zraku', fiveSpecies: 'Raznovrstna miza',
    beeBath: 'Postavljena čebelja kopel', firstHive: 'Panj brenči', tenSpecies: 'Prostor za vse',
    hedgesUnlocked: 'Zavetni pasovi', yearRoundBloom: 'Nič gostije, nič lakote', hotelGuests: 'Soba 1 je zasedena',
    rarePollinator: 'Redki obiskovalec', wildYearSurvived: 'Kotiček je preživel celo leto',
  },
};

export const RECIPE_LABEL_COPY: Record<Locale, Record<string, string>> = {
  en: {
    'recipe:lavender-thyme': 'Lavender & Wild Thyme', 'recipe:borage-cosmos': 'Borage & Cosmos', 'recipe:clover-poppy': 'Clover & Wild Poppy',
    'recipe:sunflower-aster': 'Sunflower & Aster', 'recipe:crocus-forget-me-not': 'Crocus & Forget-me-not',
  },
  sl: {
    'recipe:lavender-thyme': 'Sivka in divji timijan', 'recipe:borage-cosmos': 'Boreč in kozmos', 'recipe:clover-poppy': 'Detelja in divji mak',
    'recipe:sunflower-aster': 'Sončnica in aster', 'recipe:crocus-forget-me-not': 'Žafran in spomladanska lilija',
  },
};

/** season emojis (were in data/seasons.ts SEASON_INFO) */
export const SEASON_EMOJI: Record<Season, string> = {
  spring: '\u{1F33C}',
  summer: '\u{1F41D}',
  autumn: '\u{1F341}',
  winter: '\u{2744}\u{FE0F}',
};

/** visitor names */
export const VISITOR_NAME_COPY: Record<Locale, Record<string, string>> = {
  en: { queenbumble: 'Queen bumblebee', lavendermoth: 'Lavender moth', butterfly: 'Butterfly', hoverfly: 'Hoverfly' },
  sl: { queenbumble: 'Matica čmrlja', lavendermoth: 'Sivkin molj', butterfly: 'Metulj', hoverfly: 'Trepetavka' },
};
