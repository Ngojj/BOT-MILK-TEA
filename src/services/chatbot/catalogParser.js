const { MENU_ITEMS, TOPPINGS } = require("../../data/menu");
const {
  normalizeText,
  extractQuantity,
  extractSize
} = require("../../utils/text");

function normalizeAliasText(text) {
  const normalized = normalizeText(text);
  return normalized
    .replace(/\bcf\b/g, "ca phe")
    .replace(/\bcafe\b/g, "ca phe")
    .replace(/\bcp\b/g, "ca phe")
    .replace(/\bts\b/g, "tra sua")
    .replace(/\bttg\b/g, "tra trai cay")
    .replace(/\bdx\b/g, "da xay")
    .replace(/\bsocola\b/g, "socola")
    .replace(/\bmatcha\b/g, "matcha")
    .replace(/\bkm\b/g, "khoai mon")
    .replace(/\bdt\b/g, "dau tay")
    .replace(/\bcl\b/g, "chanh leo")
    .replace(/\bmx\b/g, "mam xoi");
}

function findItemInText(text) {
  const normalized = normalizeAliasText(text);
  const byCode = MENU_ITEMS.find((it) => normalized.includes(it.id.toLowerCase()));
  if (byCode) return byCode;

  const byExactName = MENU_ITEMS.find((it) => normalized.includes(normalizeText(it.name)));
  if (byExactName) return byExactName;

  const textTokens = normalized.split(/\s+/).filter(Boolean);
  let best = null;
  let bestScore = 0;

  for (const item of MENU_ITEMS) {
    const itemTokens = normalizeText(item.name).split(/\s+/).filter(Boolean);
    const matched = itemTokens.filter((token) => textTokens.includes(token)).length;
    if (matched === 0) continue;
    const score = matched / itemTokens.length;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  if (best && bestScore >= 0.5) return best;
  return null;
}

function findItemFromHint(hint) {
  if (!hint) return null;
  const code = normalizeText(hint.item_code || "");
  if (code) {
    const byCode = MENU_ITEMS.find((it) => normalizeText(it.id) === code);
    if (byCode) return byCode;
  }

  const name = normalizeText(hint.item_name || "");
  if (!name) return null;
  return MENU_ITEMS.find((it) => normalizeText(it.name).includes(name) || name.includes(normalizeText(it.name)));
}

function parseToppings(text, quantity) {
  const normalized = normalizeText(text);
  const explicitNoTopping =
    /\b(khong|ko)\s*(them\s*)?(topping|top)\b/.test(normalized) ||
    /\b(khong them|thoi khong them)\b/.test(normalized);
  if (explicitNoTopping || normalized.includes("khong topping")) return [];

  const hasCodeMention = TOPPINGS.some((top) => normalized.includes(top.id.toLowerCase()));
  const hasExplicitKeyword = /\b(them|topping|top)\b/.test(normalized);
  if (!hasCodeMention && !hasExplicitKeyword) return null;

  const scopedText = normalizeToppingTypos(getToppingScopedText(normalized, hasExplicitKeyword));
  const textTokens = scopedText.split(/\s+/).filter(Boolean);
  const genericTokens = new Set(["tran", "chau", "thach", "nuoc", "cot", "bot", "tra", "them", "topping", "top"]);
  const found = [];
  for (const top of TOPPINGS) {
    const idLower = top.id.toLowerCase();
    const nameNormalized = normalizeText(top.name);
    const nameTokens = nameNormalized.split(/\s+/).filter(Boolean);
    const matchedTokens = nameTokens.filter((token) => textTokens.includes(token)).length;
    const tokenScore = nameTokens.length > 0 ? matchedTokens / nameTokens.length : 0;
    const distinctiveTokens = nameTokens.filter((token) => !genericTokens.has(token));
    const matchedDistinctive = distinctiveTokens.filter((token) => textTokens.includes(token)).length;
    const nameMatched =
      scopedText.includes(nameNormalized) ||
      nameNormalized.includes(scopedText) ||
      tokenScore >= 0.8 ||
      (matchedTokens >= 2 && matchedDistinctive >= 1);

    if (!scopedText.includes(idLower) && !nameMatched) continue;
    found.push({
      topping_id: top.id,
      name: top.name,
      quantity: quantity || 1,
      unit_price: top.price
    });
  }
  if (found.length === 0) return null;
  return found;
}

function getToppingScopedText(normalized, hasExplicitKeyword) {
  if (!hasExplicitKeyword) return normalized;

  const marker = normalized.match(/\b(?:them|topping|top)\b/);
  if (!marker || marker.index == null) return normalized;

  let scoped = normalized.slice(marker.index);
  scoped = scoped.replace(/^\b(?:them|topping|top)\b\s*/, "");

  const stopMatch = scoped.match(/\b(?:giao|ship)\b/);
  if (stopMatch && stopMatch.index != null) {
    scoped = scoped.slice(0, stopMatch.index).trim();
  }

  return scoped || normalized;
}

function normalizeToppingTypos(input) {
  if (!input) return input;
  return input
    .replace(/\bchan\s+trau\b/g, "tran chau")
    .replace(/\btran\s+trau\b/g, "tran chau")
    .replace(/\bchan\s+chau\b/g, "tran chau");
}

function parseToppingsFromHint(hint, quantity) {
  if (!hint) return null;
  const codes = Array.isArray(hint.topping_codes) ? hint.topping_codes.map((x) => normalizeText(String(x))) : [];
  const names = Array.isArray(hint.topping_names) ? hint.topping_names.map((x) => normalizeText(String(x))) : [];
  if (codes.length === 0 && names.length === 0) return null;

  return TOPPINGS.filter((top) => {
    const id = normalizeText(top.id);
    const name = normalizeText(top.name);
    return codes.includes(id) || names.some((n) => name.includes(n) || n.includes(name));
  }).map((top) => ({
    topping_id: top.id,
    name: top.name,
    quantity: quantity || 1,
    unit_price: top.price
  }));
}

function buildSystemInput(rawText, hint) {
  if (!hint) return rawText;
  const pieces = [];

  if (hint.item_code) pieces.push(hint.item_code);
  else if (hint.item_name) pieces.push(hint.item_name);

  if (hint.size === "M" || hint.size === "L") pieces.push(`size ${hint.size}`);
  if (hint.quantity && hint.quantity > 0) pieces.push(`x${hint.quantity}`);

  const toppingTokens = [];
  if (Array.isArray(hint.topping_codes)) toppingTokens.push(...hint.topping_codes);
  if (Array.isArray(hint.topping_names)) toppingTokens.push(...hint.topping_names);
  if (toppingTokens.length > 0) pieces.push(`them ${toppingTokens.join(" ")}`);

  return pieces.length > 0 ? pieces.join(" ") : rawText;
}

function startItemDraft(text, hint) {
  const foundItem = findItemFromHint(hint) || findItemInText(text);
  if (!foundItem) return null;

  const aliasText = normalizeAliasText(text);
  const size = (hint?.size === "M" || hint?.size === "L" ? hint.size : null) || extractSize(aliasText);
  const quantity = (hint?.quantity && hint.quantity > 0 ? hint.quantity : null) || extractQuantity(aliasText);
  const inferredQty = quantity && quantity > 0 ? quantity : null;
  const toppings = parseToppingsFromHint(hint, inferredQty || 1) ?? parseToppings(aliasText, inferredQty || 1);

  return {
    item_id: foundItem.id,
    name: foundItem.name,
    size,
    quantity: inferredQty,
    unit_price: size ? foundItem.prices[size] : null,
    toppings,
    subtotal: 0
  };
}

function extractItemNameIfPresent(text, hint) {
  return findItemFromHint(hint) || findItemInText(text);
}

module.exports = {
  MENU_ITEMS,
  TOPPINGS,
  findItemInText,
  findItemFromHint,
  parseToppings,
  parseToppingsFromHint,
  buildSystemInput,
  startItemDraft,
  extractItemNameIfPresent
};
