const {
  normalizeText,
  formatVnd,
  isAffirmative,
  isNegative
} = require("../utils/text");
const { analyzeCustomerMessage } = require("./geminiNluService");
const {
  isPayOSConfigured,
  createPayOSOrderCode,
  createPaymentLink
} = require("./payosService");
const { APP_BASE_URL, getMenuPhotoUrl, MENU_IMAGE_PATH, STAGE } = require("./chatbot/constants");
const {
  getSession,
  getCachedSession,
  persistSession,
  resetSession,
  resetSessionData
} = require("./chatbot/sessionStore");
const {
  registerPayOSOrder,
  persistOrder,
  getOrderByPayOSOrderCode,
  markOrderPaidByPayOSOrderCode: markOrderPaidByPayOSOrderCodeInDb
} = require("./chatbot/orderStore");
const { buildSystemInput, startItemDraft } = require("./chatbot/catalogParser");
const {
  formatMenu,
  formatOrderSummary,
  buildOrderJson,
  toPayOSItems
} = require("./chatbot/orderUtils");
const {
  collectMissingItemFields,
  updateItemIdentityIfMissing,
  tryUpdateLastItemToppings
} = require("./chatbot/itemDraftFlow");
const {
  greetingOpen,
  askItemName,
  askAddMore,
  askConfirmOrder,
  askName,
  askPhone,
  invalidPhone,
  askAddress,
  askAddressRetry,
  askDeliveryAddress,
  askNote,
  askPayment,
  askPaymentChoice,
  resetDone,
  readyNewOrder,
  cancelDone,
  unknown,
  paymentCreatedPayOS,
  payosCreateFailed,
  orderConfirmed
} = require("./chatbot/chatTone");

function markOrderPaidByPayOSOrderCode(orderCode) {
  const updated = markOrderPaidByPayOSOrderCodeInDb(orderCode);
  if (!updated) return null;

  const session = getCachedSession(updated.customerId);
  if (session?.latestOrder && session.latestOrder.order_id === updated.order.order_id) {
    session.latestOrder.payment_status = "paid";
    session.latestOrder.status = "confirmed";
    persistSession(updated.customerId, session);
  }
  return updated.order;
}

function isLikelyAddressText(text) {
  const normalized = normalizeText(text || "");
  const hasAddressKeyword =
    /\b(duong|street|hem|ngo|ngach|ap|thon|khu|quan|huyen|phuong|xa|tp|tinh|p\\.|q\\.|block|toa|chung cu|cmt|dien bien phu)\b/.test(
      normalized
    );
  const hasStreetNumber = /\d/.test(text || "");
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return (hasAddressKeyword && wordCount >= 2) || (hasStreetNumber && wordCount >= 2);
}

function extractAddressFromMessage(rawText) {
  if (!rawText) return null;
  const cleaned = rawText.replace(/\s+/g, " ").trim();
  const patterns = [
    /\b(?:giao|ship)\b\s*(?:den|tới|toi|o|ở|tai|tại)?\s*(.+)$/i,
    /\b(?:den|tới|toi|o|ở|tai|tại)\b\s+(\d[\w\s.,/-]*)$/i
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    const candidate = cleanAddressCandidate(match?.[1]);
    if (candidate && isLikelyAddressText(candidate)) {
      return candidate;
    }
  }
  return null;
}

function cleanAddressCandidate(candidate) {
  if (!candidate) return null;
  let value = String(candidate).replace(/\s+/g, " ").trim();
  value = value.replace(/^(?:den|đến|toi|tới|o|ở|tai|tại)\s+/i, "");
  value = value.replace(
    /\s+(?:ngay|liền|gap|gấp|cho toi|cho cháu|giup toi|giúp tôi|dung khong|nhe|nhé|nha|a|ạ|voi|với)\s*$/i,
    ""
  );
  value = value.replace(/\s+(?:cho toi|cho cháu|giup toi|giúp tôi|nhe|nhé|nha|a|ạ)\s*$/i, "");
  value = value.replace(/^(?:den|đến)\s+/i, "");
  return value.trim();
}

function isConfirmLike(rawText, hint) {
  if (hint?.intent === "confirm") return true;
  if (hint?.intent === "deny") return false;
  return isAffirmative(rawText);
}

function isDenyLike(rawText, hint) {
  if (hint?.intent === "deny") return true;
  if (hint?.intent === "confirm") return false;
  return isNegative(rawText);
}

async function handleMessage(customerId, message) {
  const session = getSession(customerId);
  const finalize = (payload, options = {}) => {
    if (options.persist !== false) {
      persistSession(customerId, session);
    }
    return payload;
  };
  const rawText = (message || "").trim();

  if (!rawText) {
    return finalize({ reply: "Bạn nhắn giúp mình nội dung cần hỗ trợ nhé 😊", stage: session.stage });
  }

  const hint = await analyzeCustomerMessage(rawText, { stage: session.stage });
  const text = buildSystemInput(rawText, hint);
  const normalizedRaw = normalizeText(rawText);
  const contextualAddress = extractAddressFromMessage(rawText);
  if (contextualAddress && !session.customer.address) {
    session.customer.address = contextualAddress;
  }
  const isCancelOrder =
    /\bhuy don\b/.test(normalizedRaw) ||
    /\bcancel\b/.test(normalizedRaw) ||
    /\bthoi khong dat\b/.test(normalizedRaw) ||
    /\bkhong dat nua\b/.test(normalizedRaw);

  if (isCancelOrder) {
    resetSession(customerId);
    return finalize(
      {
        reply: cancelDone(),
        stage: STAGE.GREETING
      },
      { persist: false }
    );
  }

  if (normalizedRaw === "menu" || normalizedRaw.includes("xem menu") || hint?.intent === "menu") {
    return finalize({
      reply: "",
      telegram: {
        photoUrl: getMenuPhotoUrl(),
        photoFilePath: MENU_IMAGE_PATH,
        photoCaption: "📋 MENU HIỆN TẠI\n\nBạn muốn đặt món nào trước ạ? 🧋",
        fallbackText: formatMenu()
      },
      stage: session.stage
    });
  }

  if (normalizedRaw === "reset" || normalizedRaw.includes("lam lai don moi")) {
    resetSession(customerId);
    return finalize(
      {
        reply: resetDone(),
        stage: STAGE.GREETING
      },
      { persist: false }
    );
  }

  if (session.stage === STAGE.FINALIZED) {
    resetSessionData(session);
    return finalize({ reply: readyNewOrder(), stage: session.stage });
  }

  if (session.stage === STAGE.GREETING) {
    const draft = startItemDraft(text, hint);
    if (!draft) {
      return finalize({
        reply: greetingOpen(),
        stage: session.stage
      });
    }
    session.currentItem = draft;
    session.stage = STAGE.COLLECTING_ITEM;
    return finalize({ reply: collectMissingItemFields(session, text, hint), stage: session.stage });
  }

  if (session.stage === STAGE.COLLECTING_ITEM) {
    if (session.cart.length > 0 && (isNegative(rawText) || hint?.intent === "deny")) {
      session.stage = STAGE.CONFIRM_ORDER;
      return finalize({ reply: formatOrderSummary(session.cart), stage: session.stage });
    }

    if (!session.currentItem) {
      const draft = startItemDraft(text, hint);
      if (!draft) {
        return finalize({
          reply: askItemName(),
          stage: session.stage
        });
      }
      session.currentItem = draft;
    } else {
      updateItemIdentityIfMissing(session, text, hint);
    }
    return finalize({ reply: collectMissingItemFields(session, text, hint), stage: session.stage });
  }

  if (session.stage === STAGE.ASK_ADD_MORE) {
    const toppingUpdate = tryUpdateLastItemToppings(session, text, hint, normalizedRaw);
    if (toppingUpdate) {
      return finalize({
        reply: toppingUpdate.reply,
        stage: session.stage
      });
    }

    const draft = startItemDraft(text, hint);
    if (draft) {
      session.currentItem = draft;
      session.stage = STAGE.COLLECTING_ITEM;
      return finalize({ reply: collectMissingItemFields(session, text, hint), stage: session.stage });
    }
    if (hint?.intent === "order" || isConfirmLike(rawText, hint)) {
      session.stage = STAGE.COLLECTING_ITEM;
      return finalize({
        reply: "Mình sẵn sàng lên món tiếp theo nè, bạn nhắn món bạn muốn gọi giúp mình nhé.",
        stage: session.stage
      });
    }
    if (isDenyLike(rawText, hint)) {
      session.stage = STAGE.CONFIRM_ORDER;
      return finalize({ reply: formatOrderSummary(session.cart), stage: session.stage });
    }
    return finalize({ reply: askAddMore(), stage: session.stage });
  }

  if (session.stage === STAGE.CONFIRM_ORDER) {
    if (isConfirmLike(rawText, hint)) {
      session.stage = STAGE.COLLECT_CUSTOMER_NAME;
      return finalize({ reply: askName(), stage: session.stage });
    }
    if (isDenyLike(rawText, hint)) {
      session.stage = STAGE.COLLECTING_ITEM;
      return finalize({
        reply: "Bạn muốn chỉnh đơn theo hướng nào? Bạn có thể nhắn món cần thêm/sửa, hoặc nhắn `reset` để làm lại đơn mới.",
        stage: session.stage
      });
    }
    return finalize({ reply: askConfirmOrder(), stage: session.stage });
  }

  if (session.stage === STAGE.COLLECT_CUSTOMER_NAME) {
    session.customer.name = rawText;
    session.stage = STAGE.COLLECT_CUSTOMER_PHONE;
    return finalize({ reply: askPhone(), stage: session.stage });
  }

  if (session.stage === STAGE.COLLECT_CUSTOMER_PHONE) {
    const phone = rawText.replace(/[^\d]/g, "");
    if (phone.length < 9 || phone.length > 11) {
      return finalize({ reply: invalidPhone(), stage: session.stage });
    }
    session.customer.phone = phone;
    if (session.customer.address && session.customer.address !== "Tự đến lấy") {
      session.stage = STAGE.COLLECT_CUSTOMER_NOTE;
      return finalize({
        reply: `Mình đã ghi nhận địa chỉ bạn gửi trước đó: ${session.customer.address}.\n${askNote()}`,
        stage: session.stage
      });
    }

    session.stage = STAGE.COLLECT_CUSTOMER_ADDRESS;
    return finalize({
      reply: askAddress(),
      stage: session.stage
    });
  }

  if (session.stage === STAGE.COLLECT_CUSTOMER_ADDRESS) {
    const normalizedRaw2 = normalizeText(rawText);
    if (/\b(o tren|ở trên|da gui truoc|đã gửi trước|noi o tren|nói ở trên)\b/.test(normalizedRaw2)) {
      if (session.customer.address && session.customer.address !== "Tự đến lấy") {
        session.stage = STAGE.COLLECT_CUSTOMER_NOTE;
        return finalize({
          reply: `Mình lấy lại địa chỉ bạn đã gửi: ${session.customer.address}.\n${askNote()}`,
          stage: session.stage
        });
      }
      return finalize({
        reply: askAddressRetry(),
        stage: session.stage
      });
    }

    if (/tu den lay|tu lay|den lay|lay tai quan/.test(normalizedRaw2)) {
      session.customer.address = "Tự đến lấy";
      session.stage = STAGE.COLLECT_CUSTOMER_NOTE;
      return finalize({
        reply: askNote(),
        stage: session.stage
      });
    }

    if (/\b(giao|ship)\b/.test(normalizedRaw2) && !isLikelyAddressText(rawText)) {
      return finalize({
        reply: askDeliveryAddress(),
        stage: session.stage
      });
    }

    const hasAddressKeyword =
      /\b(so|duong|hem|ngo|ngach|ap|thon|khu|quan|huyen|phuong|xa|tp|tinh|p\\.|q\\.|block|toa|chung cu)\b/.test(
        normalizedRaw2
      );
    const hasStreetNumber = /\d/.test(rawText);
    const wordCount = normalizedRaw2.split(/\s+/).filter(Boolean).length;
    const validAddress = (hasAddressKeyword && wordCount >= 3) || (hasStreetNumber && wordCount >= 3);

    if (!validAddress) {
      return finalize({
        reply: askAddressRetry(),
        stage: session.stage
      });
    }

    session.customer.address = cleanAddressCandidate(rawText) || rawText;
    session.stage = STAGE.COLLECT_CUSTOMER_NOTE;
    return finalize({
      reply: askNote(),
      stage: session.stage
    });
  }

  if (session.stage === STAGE.COLLECT_CUSTOMER_NOTE) {
    session.customer.note = isDenyLike(rawText, hint) ? null : rawText;
    session.stage = STAGE.COLLECT_PAYMENT;
    return finalize({ reply: askPayment(), stage: session.stage });
  }

  if (session.stage === STAGE.COLLECT_PAYMENT) {
    if (/cod/.test(normalizedRaw) || normalizedRaw.includes("khi nhan")) {
      session.paymentMethod = "COD";
      session.paymentStatus = "pending";
    } else if (normalizedRaw.includes("chuyen khoan") || normalizedRaw.includes("transfer")) {
      session.paymentMethod = "transfer";
      session.paymentStatus = "pending";
    } else {
      return finalize({ reply: askPaymentChoice(), stage: session.stage });
    }

    const order = buildOrderJson(session);

    if (session.paymentMethod === "transfer" && isPayOSConfigured()) {
      try {
        const payosOrderCode = createPayOSOrderCode();
        const paymentLink = await createPaymentLink({
          orderCode: payosOrderCode,
          amount: order.total,
          description: `DH ${order.order_id}`,
          items: toPayOSItems(session.cart),
          buyerName: order.customer.name,
          buyerPhone: order.customer.phone,
          buyerAddress: order.customer.address
        });

        order.payment_provider = "payOS";
        order.payos_order_code = payosOrderCode;
        order.payos_payment_link_id = paymentLink.paymentLinkId;
        order.payos_checkout_url = paymentLink.checkoutUrl;
        order.payos_qr_code = paymentLink.qrCode;
        order.payos_qr_image_url = `${APP_BASE_URL}/api/payments/qr/${payosOrderCode}.png`;

        registerPayOSOrder(payosOrderCode, customerId, order);

        session.latestOrder = order;
        session.stage = STAGE.FINALIZED;

        return finalize({
          reply:
            `${paymentCreatedPayOS(order)}\n` +
            `Mã thanh toán: ${payosOrderCode}\n` +
            `Tổng tiền: ${formatVnd(order.total)}\n` +
            `Nội dung chuyển khoản: DH ${order.order_id}\n` +
            `Link thanh toán: ${paymentLink.checkoutUrl}\n` +
            "Mình gửi kèm ảnh QR ngay bên dưới để bạn quét nhanh. Shop sẽ tự động ghi nhận khi thanh toán thành công.",
          stage: session.stage,
          order,
          telegram: {
            photoQrCode: paymentLink.qrCode,
            photoCaption:
              `QR chuyển khoản đơn ${order.order_id}\n` +
              `Số tiền: ${formatVnd(order.total)}\n` +
              `Nội dung CK: DH ${order.order_id}`
          }
        });
      } catch (error) {
        session.latestOrder = order;
        session.stage = STAGE.FINALIZED;
        persistOrder(customerId, order);
        return finalize({
          reply:
            `${payosCreateFailed(order.order_id)}\n` +
            "Bạn thử lại thanh toán sau hoặc chọn COD giúp mình nhé.",
          stage: session.stage,
          order
        });
      }
    }

    persistOrder(customerId, order);
    session.latestOrder = order;
    session.stage = STAGE.FINALIZED;
    const transferLine =
      session.paymentMethod === "transfer"
        ? "\nHiện chưa cấu hình PayOS, shop sẽ gửi thông tin chuyển khoản thủ công."
        : "";
    const isPickup = normalizeText(session.customer.address) === normalizeText("Tự đến lấy");
    const transferSuffix = transferLine ? `${transferLine}\n` : "\n";

    return finalize({
      reply:
        `${orderConfirmed({
          orderId: order.order_id,
          totalFormatted: formatVnd(order.total),
          paymentMethod: order.payment_method,
          isPickup
        })}\n` + `${transferSuffix}` + "Cảm ơn bạn nhiều nhé! 😊",
      stage: session.stage,
      order
    });
  }

  return finalize({ reply: unknown(), stage: session.stage });
}

module.exports = {
  handleMessage,
  resetSession,
  getSession,
  formatMenu,
  markOrderPaidByPayOSOrderCode,
  getOrderByPayOSOrderCode
};
