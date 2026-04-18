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
    .replace(/\bmx\b/g, "mam xoi")
    .replace(/\bchan\s+trau\b/g, "tran chau")
    .replace(/\btran\s+trau\b/g, "tran chau")
    .replace(/\bchan\s+chau\b/g, "tran chau");
}

function findItemInText(text) {
  const normalized = normalizeAliasText(text);
  const byCode = MENU_ITEMS.find((it) => normalized.includes(it.id.toLowerCase()));
  if (byCode) return byCode;

  const byExactName = MENU_ITEMS.find((it) => normalized.includes(normalizeAliasText(it.name)));
  if (byExactName) return byExactName;

  const textTokens = normalized.split(/\s+/).filter(Boolean);
  let best = null;
  let bestScore = 0;

  for (const item of MENU_ITEMS) {
    const itemTokens = normalizeAliasText(item.name).split(/\s+/).filter(Boolean);
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

  const name = normalizeAliasText(hint.item_name || "");
  if (!name) return null;
  return MENU_ITEMS.find((it) => {
    const itemName = normalizeAliasText(it.name);
    return itemName.includes(name) || name.includes(itemName);
  });
}

function getLineItemsFromHint(hint) {
  if (!hint || !Array.isArray(hint.line_items)) return [];
  return hint.line_items
    .map((line) => {
      const found = findItemFromHint({
        item_code: line.item_code,
        item_name: line.item_name
      });
      if (!found) return null;
      const size = line.size === "M" || line.size === "L" ? line.size : null;
      const quantity = Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 1;
      return {
        item: found,
        size,
        quantity,
        topping_codes: line.topping_codes || [],
        topping_names: line.topping_names || []
      };
    })
    .filter(Boolean);
}

function getLineItemsFromText(text, hint) {
  const normalized = normalizeAliasText(text || "");
  if (!normalized) return [];

  const clauses = normalized
    .split(/\s+\bva\b\s+|,/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (clauses.length < 2) return [];

  const parsed = clauses
    .map((clause) => {
      const item = findItemInText(clause);
      if (!item) return null;
      const size = extractSize(clause);
      const quantity = extractQuantity(clause) || 1;
      const toppings = parseToppings(clause, quantity) || [];
      return { item, size, quantity, toppings };
    })
    .filter(Boolean);

  if (parsed.length < 2) return [];

  const fallbackSize = hint?.size === "M" || hint?.size === "L" ? hint.size : extractSize(normalized);
  for (const line of parsed) {
    if (!line.size && fallbackSize) line.size = fallbackSize;
  }

  return parsed.filter((line) => line.size && line.quantity);
}

function parseToppings(text, quantity) {
  const normalized = normalizeText(text);
  const explicitNoTopping =
    /\b(khong|ko)\s*(them\s*)?(topping|toping|top)\b/.test(normalized) ||
    /\b(khong them|thoi khong them)\b/.test(normalized);
  if (explicitNoTopping || normalized.includes("khong topping")) return [];

  const hasCodeMention = TOPPINGS.some((top) => normalized.includes(top.id.toLowerCase()));
  const hasExplicitKeyword = /\b(them|topping|toping|top)\b/.test(normalized);
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
  if (found.length === 0) {
    // Treat generic "tran chau" as default black pearl.
    if (/\btran\s+chau\b/.test(scopedText)) {
      const defaultTop = TOPPINGS.find((top) => top.id === "TOP01");
      if (defaultTop) {
        return [{
          topping_id: defaultTop.id,
          name: defaultTop.name,
          quantity: quantity || 1,
          unit_price: defaultTop.price
        }];
      }
    }
    return null;
  }
  return found;
}

function getToppingScopedText(normalized, hasExplicitKeyword) {
  if (!hasExplicitKeyword) return normalized;

  const marker = normalized.match(/\b(?:them|topping|toping|top)\b/);
  if (!marker || marker.index == null) return normalized;

  let scoped = normalized.slice(marker.index);
  scoped = scoped.replace(/^\b(?:them|topping|toping|top)\b\s*/, "");

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
  const lineItems = getLineItemsFromHint(hint);

  if (lineItems.length > 0) {
    lineItems.forEach((line) => {
      const tokens = [line.item.id];
      if (line.size) tokens.push(`size ${line.size}`);
      if (line.quantity) tokens.push(`x${line.quantity}`);
      pieces.push(tokens.join(" "));
    });
  }

  if (pieces.length === 0) {
    if (hint.item_code) pieces.push(hint.item_code);
    else if (hint.item_name) pieces.push(hint.item_name);

    if (hint.size === "M" || hint.size === "L") pieces.push(`size ${hint.size}`);
    if (hint.quantity && hint.quantity > 0) pieces.push(`x${hint.quantity}`);
  }

  const toppingTokens = [];
  if (Array.isArray(hint.topping_codes)) toppingTokens.push(...hint.topping_codes);
  if (Array.isArray(hint.topping_names)) toppingTokens.push(...hint.topping_names);
  if (toppingTokens.length > 0) pieces.push(`them ${toppingTokens.join(" ")}`);

  return pieces.length > 0 ? pieces.join(" ") : rawText;
}

function startItemDraft(text, hint) {
  const hintedLineItems = getLineItemsFromHint(hint);
  const textLineItems = getLineItemsFromText(text, hint);
  const lineItems = textLineItems.length > hintedLineItems.length ? textLineItems : hintedLineItems;
  const normalizedMultiItems = lineItems
    .filter((line) => line.item && line.size && line.quantity)
    .map((line, idx) => {
      let tops = line.toppings || parseToppingsFromHint({ topping_codes: line.topping_codes, topping_names: line.topping_names }, line.quantity);
      if ((!tops || tops.length === 0) && textLineItems[idx] && textLineItems[idx].item.id === line.item.id) {
        tops = textLineItems[idx].toppings;
      }
      return {
        item_id: line.item.id,
        name: line.item.name,
        size: line.size,
        quantity: line.quantity,
        unit_price: line.item.prices[line.size],
        toppings: tops || []
      };
    });
  const mergedMultiItems = [];
  for (const line of normalizedMultiItems) {
    const existed = mergedMultiItems.find((it) => it.item_id === line.item_id && it.size === line.size);
    if (existed) {
      existed.quantity += line.quantity;
    } else {
      mergedMultiItems.push({ ...line });
    }
  }

  const firstLine = lineItems[0] || null;
  const foundItem = firstLine?.item || findItemFromHint(hint) || findItemInText(text);
  if (!foundItem) return null;

  const aliasText = normalizeAliasText(text);
  const groupedSizes = lineItems.filter((line) => line.item.id === foundItem.id && line.size && line.quantity);
  const size = firstLine?.size || (hint?.size === "M" || hint?.size === "L" ? hint.size : null) || extractSize(aliasText);
  const quantity =
    (groupedSizes.length > 0 ? groupedSizes.reduce((sum, line) => sum + line.quantity, 0) : null) ||
    (firstLine?.quantity || null) ||
    (hint?.quantity && hint.quantity > 0 ? hint.quantity : null) ||
    extractQuantity(aliasText);
  const inferredQty = quantity && quantity > 0 ? quantity : null;
  const toppings = parseToppingsFromHint(hint, inferredQty || 1) ?? parseToppings(aliasText, inferredQty || 1);
  const sizeBreakdown =
    groupedSizes.length > 1
      ? groupedSizes.map((line) => ({ size: line.size, quantity: line.quantity }))
      : null;

  return {
    item_id: foundItem.id,
    name: foundItem.name,
    size,
    quantity: inferredQty,
    unit_price: size ? foundItem.prices[size] : null,
    multi_items: mergedMultiItems.length > 1 ? mergedMultiItems : null,
    size_breakdown: sizeBreakdown,
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
