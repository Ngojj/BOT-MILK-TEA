const { extractQuantity, extractSize, isNegative } = require("../../utils/text");
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
  extractItemNameIfPresent
} = require("./catalogParser");
const { calcItemSubtotal } = require("./orderUtils");

function finalizeDraftToCart(session) {
  session.currentItem.subtotal = calcItemSubtotal(session.currentItem);
  session.cart.push(session.currentItem);
  session.currentItem = null;
  session.stage = STAGE.ASK_ADD_MORE;
}

function collectMissingItemFields(session, text, hint) {
  const draft = session.currentItem;
  if (!draft.size) {
    const size = (hint?.size === "M" || hint?.size === "L" ? hint.size : null) || extractSize(text);
    if (!size || !["M", "L"].includes(size)) {
      return askSize();
    }
    const menuItem = MENU_ITEMS.find((it) => it.id === draft.item_id);
    draft.size = size;
    draft.unit_price = menuItem.prices[size];
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
    if (hint?.intent === "deny" || isNegative(text)) {
      draft.toppings = [];
    } else {
    const tops = parseToppingsFromHint(hint, draft.quantity) ?? parseToppings(text, draft.quantity);
    if (tops === null) {
      return askToppingMissing();
    }
    draft.toppings = tops;
    }
  }

  finalizeDraftToCart(session);
  const last = session.cart[session.cart.length - 1];
  return itemAdded(last);
}

function updateItemIdentityIfMissing(session, text, hint) {
  const detectedItem = extractItemNameIfPresent(text, hint);
  if (detectedItem && !session.currentItem.item_id) {
    session.currentItem.item_id = detectedItem.id;
    session.currentItem.name = detectedItem.name;
  }
}

function tryUpdateLastItemToppings(session, text, hint, normalizedRaw) {
  if (isNegative(text) || hint?.intent === "deny") {
    return null;
  }

  if (!(session.cart.length > 0 && /\b(them|topping|top)\b/.test(normalizedRaw))) {
    return null;
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
