const { normalizeText, extractQuantity, extractSize, isNegative } = require("../../utils/text");
const { STAGE } = require("./constants");
const {
  askSize,
  askQuantity,
  askToppingMissing,
  itemAdded,
  askToppingClarify,
  toppingUpdated
} = require("./chatTone");
const {
  MENU_ITEMS,
  parseToppings,
  parseToppingsFromHint,
  startItemDraft,
  extractItemNameIfPresent,
  findItemFromHint
} = require("./catalogParser");
const { calcItemSubtotal } = require("./orderUtils");

const EXTRA_DENY_PATTERNS =
  /^(kh|k|ko|khoong|khong|khg|kg|không|thôi|thoi|không cần|khong can|không thêm|khong them|no|nope)$/i;

function isDeny(text, hint) {
  if (hint?.intent === "deny") return true;
  if (isNegative(text)) return true;
  const normalized = String(text || "").trim().toLowerCase();
  return EXTRA_DENY_PATTERNS.test(normalized);
}

function createAddGroupId() {
  return `grp_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function extractSizeBreakdown(text) {
  const normalized = String(text || "").toLowerCase();
  const pattern = /(\d+)\s*(?:ly|coc)?\s*(?:size)?\s*([ml])\b/g;
  const found = [];
  let match = pattern.exec(normalized);
  while (match) {
    found.push({
      quantity: Number(match[1]),
      size: match[2].toUpperCase()
    });
    match = pattern.exec(normalized);
  }
  if (found.length < 2) return null;
  return found.filter((entry) => Number.isFinite(entry.quantity) && entry.quantity > 0);
}

function extractSizeBreakdownFromHint(draft, hint) {
  if (!draft || !hint || !Array.isArray(hint.line_items)) return null;
  const parts = hint.line_items
    .filter((line) => line?.item_code === draft.item_id && (line.size === "M" || line.size === "L"))
    .map((line) => ({
      size: line.size,
      quantity: Number.isFinite(line.quantity) && line.quantity > 0 ? Number(line.quantity) : 0
    }))
    .filter((line) => line.quantity > 0);
  if (parts.length < 2) return null;
  return parts;
}

function inferSizeByItemMention(text, itemName) {
  const normalizedText = normalizeText(text || "");
  const normalizedItemName = normalizeText(itemName || "");
  if (!normalizedText || !normalizedItemName) return null;

  const itemIndex = normalizedText.indexOf(normalizedItemName);
  if (itemIndex < 0) return null;

  const nextSeparator = normalizedText.indexOf(" va ", itemIndex + normalizedItemName.length);
  const scoped = nextSeparator > itemIndex
    ? normalizedText.slice(itemIndex, nextSeparator)
    : normalizedText.slice(itemIndex);
  const scopedSize = extractSize(scoped);
  if (scopedSize === "M" || scopedSize === "L") return scopedSize;
  return null;
}

function buildMultiItemsFromHint(hint, fallbackSize, text) {
  if (!hint || !Array.isArray(hint.line_items) || hint.line_items.length === 0) return null;
  const normalizedText = text || "";
  const normalized = hint.line_items
    .map((line) => {
      const item = findItemFromHint({
        item_code: line?.item_code,
        item_name: line?.item_name
      });
      if (!item) return null;
      const quantity = Number.isFinite(line.quantity) && line.quantity > 0 ? Number(line.quantity) : null;
      const explicitSize = line.size === "M" || line.size === "L" ? line.size : null;
      const inferredByItem = inferSizeByItemMention(normalizedText, item.name);
      const size = explicitSize || inferredByItem;
      if (!quantity) return null;
      return {
        item_id: item.id,
        name: item.name,
        size,
        quantity,
        unit_price: size ? item.prices[size] : null,
        toppings: parseToppingsFromHint({ topping_codes: line.topping_codes, topping_names: line.topping_names }, quantity) || []
      };
    })
    .filter(Boolean);
  if (normalized.length === 0) return null;

  const uniqueItemIds = [...new Set(normalized.map((line) => line.item_id))];
  const uniqueSizes = [...new Set(normalized.map((line) => line.size).filter(Boolean))];
  const inferredSize =
    uniqueSizes.length === 1 ? uniqueSizes[0] : uniqueItemIds.length === 1 ? fallbackSize || null : null;
  for (const line of normalized) {
    if (!line.size && inferredSize) {
      line.size = inferredSize;
      const menuItem = MENU_ITEMS.find((it) => it.id === line.item_id);
      line.unit_price = menuItem?.prices?.[inferredSize] ?? null;
    }
  }

  if (normalized.some((line) => !line.size)) return null;

  const merged = [];
  for (const line of normalized) {
    const existed = merged.find((it) => it.item_id === line.item_id && it.size === line.size);
    if (existed) {
      existed.quantity += line.quantity;
      continue;
    }
    merged.push({ ...line });
  }
  return merged;
}

function finalizeDraftToCart(session) {
  const draft = session.currentItem;
  const addGroupId = createAddGroupId();
  if (Array.isArray(draft.multi_items) && draft.multi_items.length > 0) {
    for (const multi of draft.multi_items) {
      const cartItem = {
        item_id: multi.item_id,
        name: multi.name,
        size: multi.size,
        quantity: multi.quantity,
        unit_price: multi.unit_price,
        toppings: (multi.toppings && multi.toppings.length > 0)
          ? multi.toppings.map((top) => ({ ...top, quantity: multi.quantity }))
          : draft.multi_items.some(m => m.toppings && m.toppings.length > 0)
            ? [] // Some other item claimed the toppings, so this one shouldn't get the global fallback
            : Array.isArray(draft.toppings)
              ? draft.toppings.map((top) => ({ ...top, quantity: multi.quantity }))
              : [],
        add_group_id: addGroupId,
        subtotal: 0
      };
      cartItem.subtotal = calcItemSubtotal(cartItem);
      session.cart.push(cartItem);
    }
    session.currentItem = null;
    session.stage = STAGE.ASK_ADD_MORE;
    return addGroupId;
  }

  const sizeBreakdown = Array.isArray(draft.size_breakdown) ? draft.size_breakdown : null;
  if (sizeBreakdown && sizeBreakdown.length > 0) {
    const menuItem = MENU_ITEMS.find((it) => it.id === draft.item_id);
    for (const part of sizeBreakdown) {
      const cloned = {
        ...draft,
        size: part.size,
        quantity: part.quantity,
        unit_price: menuItem?.prices?.[part.size] ?? draft.unit_price,
        toppings: Array.isArray(draft.toppings)
          ? draft.toppings.map((top) => ({ ...top, quantity: part.quantity }))
          : draft.toppings
      };
      cloned.subtotal = calcItemSubtotal(cloned);
      cloned.add_group_id = addGroupId;
      delete cloned.size_breakdown;
      session.cart.push(cloned);
    }
  } else {
    draft.subtotal = calcItemSubtotal(draft);
    draft.add_group_id = addGroupId;
    session.cart.push(draft);
  }
  session.currentItem = null;
  session.stage = STAGE.ASK_ADD_MORE;
  return addGroupId;
}

function collectMissingItemFields(session, text, hint) {
  const draft = session.currentItem;
  const hintedMultiItems = buildMultiItemsFromHint(hint, draft.size, text);
  if (hintedMultiItems && hintedMultiItems.length > 0) {
    const first = hintedMultiItems[0];
    draft.item_id = first.item_id;
    draft.name = first.name;
    draft.size = first.size;
    draft.quantity = hintedMultiItems.reduce((sum, line) => sum + line.quantity, 0);
    draft.unit_price = first.unit_price;
    draft.multi_items = hintedMultiItems;
  }

  // Always resolve multi-size first so single-size fallback cannot overwrite it.
  const sizeBreakdown = extractSizeBreakdownFromHint(draft, hint) || extractSizeBreakdown(text);
  if (sizeBreakdown && sizeBreakdown.length > 0) {
    const totalQtyFromSizes = sizeBreakdown.reduce((sum, part) => sum + part.quantity, 0);
    if (draft.quantity && draft.quantity !== totalQtyFromSizes) {
      return `Sốp thấy khách chia size tổng ${totalQtyFromSizes} ly, nhưng trước đó là ${draft.quantity} ly. Khách chốt lại giúp sốp nha.`;
    }
    draft.size_breakdown = sizeBreakdown;
    draft.quantity = totalQtyFromSizes;
    draft.size = sizeBreakdown[0].size;
    const menuItem = MENU_ITEMS.find((it) => it.id === draft.item_id);
    draft.unit_price = menuItem.prices[draft.size];
  }

  if (!draft.size) {
    const size = (hint?.size === "M" || hint?.size === "L" ? hint.size : null) || extractSize(text);
    if (!size || !["M", "L"].includes(size)) {
      return askSize();
    }
    if (!draft.size_breakdown) {
      const menuItem = MENU_ITEMS.find((it) => it.id === draft.item_id);
      draft.size = size;
      draft.unit_price = menuItem.prices[size];
    }
  }

  if (!draft.quantity) {
    const qty = (hint?.quantity && hint.quantity > 0 ? hint.quantity : null) || extractQuantity(text);
    if (!qty || qty < 1) {
      return askQuantity();
    }
    draft.quantity = qty;
    if ((draft.toppings || []).length > 0) {
      draft.toppings = draft.toppings.map((top) => ({ ...top, quantity: qty }));
    }
  }

  if (draft.toppings === null) {
    if (Array.isArray(draft.multi_items) && draft.multi_items.length > 1) {
      const tops = parseToppingsFromHint(hint, draft.quantity) ?? parseToppings(text, draft.quantity);
      draft.toppings = tops ?? [];
    } else if (isDeny(text, hint)) {
      draft.toppings = [];
    } else {
      const tops = parseToppingsFromHint(hint, draft.quantity) ?? parseToppings(text, draft.quantity);
      if (tops === null) {
        return askToppingMissing();
      }
      draft.toppings = tops;
    }
  }

  const addedGroupId = finalizeDraftToCart(session);
  const recentlyAdded = session.cart[session.cart.length - 1];
  const groupedAddedItems = session.cart.filter((item) => item.add_group_id === addedGroupId);

  if (groupedAddedItems.length > 1) {
    const addedText = groupedAddedItems.map((item) => `${item.name} size ${item.size} x${item.quantity}`).join(", ");
    return `Sốp đã thêm ${addedText} ✅ Khách cần gọi thêm thì nhắn tiếp, hoặc nhắn \`không\` để sốp chốt đơn nhe.`;
  }

  const multiLineAdded =
    Array.isArray(draft.size_breakdown) && draft.size_breakdown.length > 1
      ? draft.size_breakdown
          .map((part) => `${draft.name} size ${part.size} x${part.quantity}`)
          .join(", ")
      : null;

  if (!multiLineAdded) {
    return itemAdded(recentlyAdded);
  }
  return `Sốp đã thêm ${multiLineAdded} ✅ Khách cần gọi thêm thì nhắn tiếp, hoặc nhắn \`không\` để sốp chốt đơn nhe.`;
}

function updateItemIdentityIfMissing(session, text, hint) {
  const detectedItem = extractItemNameIfPresent(text, hint);
  if (detectedItem && !session.currentItem.item_id) {
    session.currentItem.item_id = detectedItem.id;
    session.currentItem.name = detectedItem.name;
  }
}

function tryUpdateLastItemToppings(session, text, hint, normalizedRaw) {
  if (isDeny(text, hint)) {
    return null;
  }

  if (!(session.cart.length > 0 && /\b(them|topping|top)\b/.test(normalizedRaw))) {
    return null;
  }

  const hasSpecificToppingInText =
    /\b(top\d{2}|tran chau|thach|nuoc cot dua|kem tuoi|gelee|bot tra xanh)\b/.test(normalizedRaw);
  const hasSpecificToppingInHint =
    (Array.isArray(hint?.topping_codes) && hint.topping_codes.length > 0) ||
    (Array.isArray(hint?.topping_names) && hint.topping_names.length > 0);
  if (!hasSpecificToppingInText && !hasSpecificToppingInHint) {
    return {
      ok: false,
      reply: askToppingClarify()
    };
  }

  const lastItem = session.cart[session.cart.length - 1];
  const tops = parseToppingsFromHint(hint, lastItem.quantity) ?? parseToppings(text, lastItem.quantity);
  if (tops === null) {
    return {
      ok: false,
      reply: askToppingClarify()
    };
  }

  lastItem.toppings = tops;
  lastItem.subtotal = calcItemSubtotal(lastItem);
  return {
    ok: true,
    reply: toppingUpdated(lastItem)
  };
}

module.exports = {
  startItemDraft,
  collectMissingItemFields,
  updateItemIdentityIfMissing,
  tryUpdateLastItemToppings
};
