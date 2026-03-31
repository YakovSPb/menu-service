import { normalizeRecipeSearchQuery } from './recipe-name';

const STOP_WORDS = new Set<string>(['в', 'на', 'под', 'и', 'с', 'без', 'для', 'но', 'а']);

/** Группы стемов, считающихся эквивалентными при поиске по рецептам (диктовка vs написанное). */
const RECIPE_STEM_EQUIVALENTS: string[][] = [
  ['слив', 'сливоч', 'сливочн'],
  ['масл'],
  ['мук', 'муки'],
  ['рисов', 'рис'],
  ['пшенич', 'пшеничн'],
  ['яйц', 'яич'],
  ['молоч', 'молок'],
  ['сахар'],
  ['сол'],
  ['творож', 'творог'],
  ['сметан'],
  ['овощ', 'овощн'],
  ['помидор', 'помидорн'],
  ['огурц', 'огурч'],
  ['лук', 'луков'],
  ['чеснок', 'чесноч'],
  ['перец', 'перч'],
  ['морков', 'морковн'],
  ['картош', 'картофел'],
  ['куриц', 'курин'],
  ['мяс', 'мясн'],
  ['рыб'],
  ['сыр'],
  ['кефир', 'кефирн'],
  ['банан', 'бананов'],
  ['яблок', 'яблоч'],
  ['лимон', 'лимонн'],
  ['шоколад', 'шоколадн'],
  ['какао'],
  ['мед', 'медов'],
  ['ванил', 'ванильн'],
  ['кориц', 'коричн'],
  ['имбир', 'имбирн'],
];

/** Минимальная длина стема для учёта совпадения по префиксу (избегаем ложных совпадений). */
const MIN_STEM_PREFIX_LEN = 3;

function stemMatchesForRecipe(queryStem: string, itemStemSet: Set<string>): boolean {
  if (itemStemSet.has(queryStem)) return true;
  for (const group of RECIPE_STEM_EQUIVALENTS) {
    if (!group.includes(queryStem)) continue;
    if (group.some((s) => itemStemSet.has(s))) return true;
  }
  // Универсально: один стем — префикс другого (слив/сливочное, мука/муки)
  if (queryStem.length >= MIN_STEM_PREFIX_LEN) {
    for (const itemStem of itemStemSet) {
      if (
        itemStem.length >= MIN_STEM_PREFIX_LEN &&
        (itemStem.startsWith(queryStem) || queryStem.startsWith(itemStem))
      ) {
        return true;
      }
    }
  }
  return false;
}

interface PreparedTokens {
  normalized: string;
  tokens: string[];
  stems: string[];
  phoneticKeys: string[];
  bigrams: string[];
  hasTokens: boolean;
}

// Нормализация: регистр, ё → е, пунктуация
export function normalizeRussianText(input: string): string {
  const lower = input.toLowerCase();
  const replaced = lower.replace(/ё/g, 'е');
  // Удаляем знаки препинания, оставляем буквы, цифры и пробелы
  return replaced.replace(/[^a-zа-я0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}

// Простейший транслит латиницы → кириллица для типичных запросов (shaurma, pelmeni, borsh и т.п.)
export function translitToRu(input: string): string {
  if (!/[a-z]/i.test(input)) {
    return input;
  }

  const s = input.toLowerCase();
  let result = '';
  let i = 0;

  const multiMap: Record<string, string> = {
    shch: 'щ',
    sch: 'щ',
    yo: 'ё',
    jo: 'ё',
    yu: 'ю',
    ju: 'ю',
    ya: 'я',
    ja: 'я',
    kh: 'х',
    zh: 'ж',
    ch: 'ч',
    sh: 'ш',
    ts: 'ц',
  };

  const singleMap: Record<string, string> = {
    a: 'а',
    b: 'б',
    v: 'в',
    g: 'г',
    d: 'д',
    e: 'е',
    z: 'з',
    i: 'и',
    y: 'й',
    k: 'к',
    l: 'л',
    m: 'м',
    n: 'н',
    o: 'о',
    p: 'п',
    r: 'р',
    s: 'с',
    t: 'т',
    u: 'у',
    f: 'ф',
    h: 'х',
    c: 'к',
    q: 'к',
    w: 'в',
    x: 'кс',
  };

  while (i < s.length) {
    // Пробуем многобуквенные комбинации (4 → 2)
    let matched = false;
    for (let len = 4; len >= 2; len -= 1) {
      const chunk = s.slice(i, i + len);
      const mapped = multiMap[chunk];
      if (mapped) {
        result += mapped;
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const ch = s[i];
    const single = singleMap[ch];
    if (single) {
      result += single;
    } else {
      // Неизвестный символ (цифры, пробелы, кириллица и т.п.) — оставляем как есть
      result += ch;
    }
    i += 1;
  }

  return result;
}

// Упрощённый стемминг русских слов для приведения к базовой форме
export function simpleRussianStem(word: string): string {
  let w = word;
  if (w.length <= 3) return w;

  // огурец → огурц (совпадает с огурцы → огурц), помидор/помидоры уже за счёт ы/ор
  if (w.length > 4 && w.endsWith('ец')) {
    w = w.slice(0, -3) + 'ц';
  }

  const suffixes = [
    'ами',
    'ями',
    'ями',
    'ями',
    'его',
    'ого',
    'ему',
    'ому',
    'ией',
    'ией',
    'иям',
    'иях',
    'иях',
    'ами',
    'ями',
    'ах',
    'ях',
    'ов',
    'ев',
    'ей',
    'ам',
    'ям',
    'ем',
    'ом',
    'ым',
    'им',
    'ой',
    'ей',
    'ий',
    'ый',
    'ой',
    'ою',
    'ею',
    'ую',
    'юю',
    'ью',
    'ий',
    'ый',
    'ой',
    'ия',
    'ия',
    'ие',
    'ые',
    'ия',
    'ий',
    'ый',
    'ов',
    'ев',
    'ин',
    'ын',
    'ок',
    'ек',
    'ик',
    // Однобуквенные окончания (склонения / мн. число)
    'а',
    'я',
    'ы',
    'и',
    'е',
    'о',
    'у',
    'ю',
  ];

  for (const suf of suffixes) {
    if (w.length > suf.length + 2 && w.endsWith(suf)) {
      return w.slice(0, -suf.length);
    }
  }

  return w;
}

// Фонетический ключ: сводим глухие/звонкие и шипящие к общему представлению
export function phoneticKey(word: string): string {
  const map: Record<string, string> = {
    п: 'б',
    б: 'б',
    т: 'д',
    д: 'д',
    к: 'г',
    г: 'г',
    ф: 'в',
    в: 'в',
    с: 'з',
    з: 'з',
    ш: 'ш',
    ж: 'ш',
    ч: 'ш',
    щ: 'ш',
  };

  let result = '';
  for (const ch of word) {
    const mapped = map[ch];
    result += mapped ?? ch;
  }
  return result;
}

function buildBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

function prepareTokens(input: string): PreparedTokens {
  const normalized = normalizeRussianText(input);
  const rawTokens = normalized.split(/\s+/).filter(Boolean);

  const tokens = rawTokens.filter((t) => !STOP_WORDS.has(t));
  const stems = tokens.map((t) => simpleRussianStem(t));
  const phoneticKeys = stems.map((s) => phoneticKey(s));
  const bigrams = buildBigrams(stems);

  return {
    normalized,
    tokens,
    stems,
    phoneticKeys,
    bigrams,
    hasTokens: stems.length > 0,
  };
}

export interface PreparedQuery extends PreparedTokens {}

export function prepareSearchQuery(rawQuery: string): PreparedQuery {
  const withTranslit = translitToRu(rawQuery);
  return prepareTokens(withTranslit);
}

/** Нейтральные уточнители в запросе дневника (после normalizeRussianText). */
const MENU_DESCRIPTOR_TOKENS = new Set([
  'сезонно',
  'сезонное',
  'сезонный',
  'сезонная',
  'сезонные',
]);

/**
 * Убирает нейтральные уточнители («сезонное яблоко» и т.п.) из строки поиска меню в дневнике.
 */
export function stripMenuSearchDescriptors(query: string): string {
  const normalized = normalizeRussianText(query);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const kept = tokens.filter((t) => !MENU_DESCRIPTOR_TOKENS.has(t));
  return kept.join(' ').trim();
}

export interface ScoreMenuItemOptions {
  /** Учитывать эквиваленты стемов (слив/сливочное, мука/муки) — для поиска по тексту рецепта. */
  recipeStemEquivalents?: boolean;
}

export function scoreMenuItem(
  query: PreparedQuery,
  itemName: string,
  options?: ScoreMenuItemOptions
): number {
  if (!itemName) return 0;

  const itemPrepared = prepareTokens(itemName);
  const itemStemSet = new Set(itemPrepared.stems);
  const useEquivalents = options?.recipeStemEquivalents === true;
  const stemMatch = (stem: string) =>
    useEquivalents ? stemMatchesForRecipe(stem, itemStemSet) : itemStemSet.has(stem);

  // Если после обработки запрос пустой (остались только стоп-слова),
  // fallback к простому подстрочному поиску по нормализованной строке.
  if (!query.hasTokens) {
    if (!query.normalized) return 0;
    if (
      itemPrepared.normalized.includes(query.normalized) ||
      query.normalized.includes(itemPrepared.normalized)
    ) {
      return 1;
    }
    return 0;
  }

  let score = 0;

  // Полное совпадение нормализованной строки
  if (itemPrepared.normalized === query.normalized) {
    score += 1000;
  }

  // Подстрочные совпадения (борщ сметана / борщ со сметаной)
  if (
    itemPrepared.normalized.includes(query.normalized) ||
    query.normalized.includes(itemPrepared.normalized)
  ) {
    score += 500;
  }

  const itemPhonSet = new Set(itemPrepared.phoneticKeys);
  const itemBigramSet = new Set(itemPrepared.bigrams);

  // Строгое условие: все значимые слова запроса должны быть в продукте
  // применяем только для запросов из двух и более слов.
  // Для односоставных коротких запросов (например, «агу») позволяем
  // частичное совпадение по подстроке/стемму.
  if (query.stems.length > 1) {
    for (const stem of query.stems) {
      if (!stemMatch(stem)) {
        return 0;
      }
    }
  } else if (query.stems.length === 1) {
    const stem = query.stems[0];
    if (!stemMatch(stem)) {
      const hasPartialStem =
        itemPrepared.stems.some((s) => s.startsWith(stem) || stem.startsWith(s)) ||
        itemPrepared.normalized.includes(query.normalized) ||
        query.normalized.includes(itemPrepared.normalized);
      if (!hasPartialStem) {
        return 0;
      }
    }
  }

  // Совпадения по стеммам (все уже есть — считаем для весов)
  const exactTokenMatches = query.stems.length;

  // Бонус за совпадение всех слов запроса независимо от порядка (макароны варёные = варёные макароны)
  if (query.stems.length >= 2) {
    score += 80;
  }

  // Фонетические совпадения (борщ з смитаной → борщ со сметаной)
  let phoneticMatches = 0;
  for (const stem of query.stems) {
    const key = phoneticKey(stem);
    if (itemPhonSet.has(key) && !itemStemSet.has(stem)) {
      phoneticMatches += 1;
    }
  }

  // Шинглы (биграммы) — дополнительный бонус за тот же порядок слов
  let bigramMatches = 0;
  for (const bg of query.bigrams) {
    if (itemBigramSet.has(bg)) {
      bigramMatches += 1;
    }
  }

  if (bigramMatches > 0) {
    score += bigramMatches * 50;
  }
  if (exactTokenMatches > 0) {
    score += exactTokenMatches * 30;
  }
  if (phoneticMatches > 0) {
    score += phoneticMatches * 10;
  }

  // Релевантность для любого запроса: точное имя, короткие совпадения, штраф за «лишние» слова

  if (score > 0 && itemPrepared.normalized === query.normalized) {
    score += 6000;
  }

  if (
    score > 0 &&
    itemPrepared.normalized !== query.normalized &&
    itemPrepared.normalized.startsWith(query.normalized + ' ')
  ) {
    score += 800;
  }

  if (
    query.hasTokens &&
    query.stems.length === 1 &&
    score > 0 &&
    itemPrepared.normalized !== query.normalized &&
    itemPrepared.tokens.length === 1 &&
    stemMatch(query.stems[0])
  ) {
    score += 3000;
  }

  const extraTokens = itemPrepared.tokens.length - query.stems.length;
  if (score > 0 && extraTokens > 0) {
    const penal = Math.min(400, extraTokens * 32);
    score = Math.max(1, score - penal);
  }

  if (
    score > 0 &&
    query.stems.length === 1 &&
    itemPrepared.stems.length > 0 &&
    itemPrepared.stems[0] === query.stems[0]
  ) {
    score += 120;
  }

  if (score === 0) return 0;

  return score;
}

/**
 * Скоринг пункта меню по запросу с учётом названия и текста рецепта (ингредиентов).
 * Возвращает максимум из скора по названию и по тексту рецепта — чтобы поиск по ингредиентам находил рецепты.
 * Для текста рецепта включаются эквиваленты стемов (слив/сливочное, мука и т.д.) для диктовки.
 */
export function scoreMenuItemWithRecipe(
  query: PreparedQuery,
  name: string,
  recipeText: string | null | undefined
): number {
  const byName = scoreMenuItem(query, name ?? '', { recipeStemEquivalents: true });
  const byRecipe =
    recipeText?.trim() ?
      scoreMenuItem(query, recipeText.trim(), { recipeStemEquivalents: true })
    : 0;
  return Math.max(byName, byRecipe);
}

/** Очистка строки поиска как в GET /api/menu (дневник vs recipesOnly). */
export function prepareMenuListSearchQuery(search: string, recipesOnly: boolean): PreparedQuery {
  let cleaned = recipesOnly
    ? normalizeRecipeSearchQuery(search)
    : search.replace(/\d+\s*(г|грамм[а-я]*|гр\.?|мл|кг|л)/gi, '').trim();
  if (!recipesOnly) {
    cleaned = stripMenuSearchDescriptors(cleaned);
  }
  return prepareSearchQuery(cleaned);
}

export interface MenuItemLikeForSearch {
  name: string;
  recipeText?: string | null;
}

/** Первый токен выглядит как латинский бренд (есть a–z, нет кириллицы). */
function leadingTokenIsLatinBrand(token: string | undefined): boolean {
  if (!token) return false;
  if (!/[a-z]/i.test(token)) return false;
  return !/[а-яё]/i.test(token);
}

/** Запрос набран кириллицей — можно отодвигать латинские бренды в начале названия. */
function queryIsCyrillicProductSearch(q: PreparedQuery): boolean {
  return q.hasTokens && q.tokens.every((t) => /[а-яё]/i.test(t));
}

/**
 * Индекс первого токена названия, который покрывает первый стем запроса
 * (как в scoreMenuItem с recipeStemEquivalents).
 */
function firstTokenIndexMatchingQueryStem(
  namePrepared: PreparedTokens,
  queryStem: string,
  useRecipeStemEquivalents: boolean
): number {
  for (let i = 0; i < namePrepared.stems.length; i += 1) {
    const singleton = new Set([namePrepared.stems[i]]);
    const ok =
      useRecipeStemEquivalents ?
        stemMatchesForRecipe(queryStem, singleton)
      : singleton.has(queryStem);
    if (ok) return i;
  }
  return 999;
}

/**
 * Скоринг и сортировка списка меню (как локальный GET /api/menu).
 * Для shared menu: внешний сервис отдаёт другой порядок — пересчитываем здесь.
 */
export function rankMenuItemsBySearchQuery<T extends MenuItemLikeForSearch>(
  items: T[],
  preparedQuery: PreparedQuery,
  options: { recipesOnly: boolean }
): { item: T; score: number }[] {
  const qNorm = preparedQuery.normalized;
  const useEquiv = true;
  const deprioritizeLatinLead =
    queryIsCyrillicProductSearch(preparedQuery) && preparedQuery.stems.length === 1;
  const queryStem0 = preparedQuery.stems[0];
  const scored = items
    .map((item) => {
      const namePrepared = prepareTokens(item.name);
      const score =
        options.recipesOnly ?
          scoreMenuItemWithRecipe(
            preparedQuery,
            item.name,
            normalizeRecipeSearchQuery(item.recipeText ?? '') || undefined
          )
        : scoreMenuItem(preparedQuery, item.name, { recipeStemEquivalents: true });
      const exactMatch = Boolean(qNorm) && namePrepared.normalized === qNorm;
      const wordCount = namePrepared.tokens.length;
      const latinBrandFirst =
        deprioritizeLatinLead && leadingTokenIsLatinBrand(namePrepared.tokens[0]);
      const matchTokenIndex =
        preparedQuery.stems.length === 1 && queryStem0 ?
          firstTokenIndexMatchingQueryStem(namePrepared, queryStem0, useEquiv)
        : 0;
      return { item, score, exactMatch, wordCount, latinBrandFirst, matchTokenIndex };
    })
    .filter(({ score }) => score > 0);

  scored.sort((a, b) => {
    if (a.exactMatch !== b.exactMatch) {
      return a.exactMatch ? -1 : 1;
    }
    if (a.wordCount !== b.wordCount) {
      return a.wordCount - b.wordCount;
    }
    if (deprioritizeLatinLead && a.latinBrandFirst !== b.latinBrandFirst) {
      return a.latinBrandFirst ? 1 : -1;
    }
    if (a.matchTokenIndex !== b.matchTokenIndex) {
      return a.matchTokenIndex - b.matchTokenIndex;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (preparedQuery.hasTokens) {
      const la = a.item.name.length;
      const lb = b.item.name.length;
      if (la !== lb) return la - lb;
    }
    return a.item.name.localeCompare(b.item.name, 'ru');
  });

  return scored.map(({ item, score }) => ({ item, score }));
}
