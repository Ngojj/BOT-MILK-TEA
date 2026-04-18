const { MENU_ITEMS, TOPPINGS } = require("../data/menu");
const { normalizeText } = require("../utils/text");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const CONFIRM_WORDS = new Set(["ok", "roi", "r", "yes", "yup", "chuan", "xac nhan", "duoc"]);
const DENY_WORDS = new Set(["kh", "k", "ko", "khong", "thoi", "khong can", "khong them"]);
const VI_NUMBERS = { mot: 1, hai: 2, ba: 3, bon: 4, nam: 5 };

const SYNONYMS = {
  cf: "ca phe",
  cafe: "ca phe",
  "den da": "ca phe den",
  "sua da": "ca phe sua",
  matcha: "da xay matcha",
  ts: "tra sua",
  ttg: "tra trai cay",
  dx: "da xay"
};

function normalizeMessage(message) {
  let text = normalizeText(message || "");
  for (const [key, value] of Object.entries(SYNONYMS)) {
    text = text.replaceAll(key, value);
  }
  return text.trim();
}

function fallbackIntent(message) {
  const msg = normalizeText(message || "");
  if (CONFIRM_WORDS.has(msg)) return "confirm";
  if (DENY_WORDS.has(msg)) return "deny";
  return "unknown";
}

function normalizeIntent(intent) {
  const value = normalizeText(intent || "");
  const map = {
    yes: "confirm",
    no: "deny",
    decline: "deny",
    reject: "deny",
    payment_cod: "payment_cod",
    payment_transfer: "payment_transfer",
    transfer: "payment_transfer",
    cod: "payment_cod"
  };
  return map[value] || value || "unknown";
}

function extractQuantityFallback(message) {
  const tokens = normalizeText(message || "").split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (/^\d+$/.test(token)) return Number(token);
    if (VI_NUMBERS[token]) return VI_NUMBERS[token];
  }
  return null;
}

function findClosestMenuItem(message) {
  const msg = normalizeMessage(message);
  return MENU_ITEMS.find((item) => msg.includes(normalizeText(item.name))) || null;
}

function extractToppingsFallback(message) {
  const msg = normalizeMessage(message);
  return TOPPINGS.filter((topping) => msg.includes(normalizeText(topping.name)));
}

function buildSystemInstruction(context = {}) {
  const stage = context.stage || "unknown";
  const stageHints = {
    GREETING: "Thuong nhan intent menu hoac order.",
    COLLECTING_ITEM: "Tap trung trich xuat item_name/item_code/size/quantity/topping.",
    ASK_ADD_MORE: "Phan biet order tiep tuc hay deny.",
    CONFIRM_ORDER: "Phan biet confirm hoac deny.",
    COLLECT_CUSTOMER_NOTE: "Neu nguoi dung noi khong can ghi chu thi intent=deny.",
    COLLECT_PAYMENT: "Nhan dien COD hoac chuyen khoan."
  };
  const stageHintLine = stageHints[stage] || "Uu tien suy luan theo ngu canh stage hien tai.";
  const menuItems = MENU_ITEMS.map((item) => `${item.id}:${item.name}`).join(", ");
  const toppings = TOPPINGS.map((item) => `${item.id}:${item.name}`).join(", ");

  return (
    "Ban la bo phan phan tich tin nhan dat do uong. " +
    `Stage hien tai: ${stage}. ${stageHintLine} ` +
    "Can hieu tieng viet tu nhien, viet tat, slang va typo. " +
    "Viet tat thuong gap: cf=ca phe, ts=tra sua, ttg=tra trai cay, dx=da xay, kh=khong, ck=chuyen khoan. " +
    `Danh sach mon hop le: ${menuItems}. ` +
    `Danh sach topping hop le: ${toppings}. ` +
    "Tra ve DUY NHAT JSON schema: " +
    "{intent(menu|order|confirm|deny|provide_info|cancel|reset|payment_cod|payment_transfer|unknown), item_code, item_name, size(M|L|null), quantity(number|null), topping_codes(array), topping_names(array)}. " +
    "Neu nhan ra ten mon gan dung thi map ve item hop le gan nhat."
  );
}

async function callGemini(message, context = {}) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const systemInstruction = buildSystemInstruction(context);

  const body = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json"
    },
    contents: [
      {
        role: "user",
        parts: [{ text: message }]
      }
    ]
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!res.ok) {
        const isLastAttempt = attempt === 2;
        if (isLastAttempt) return null;
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        const isLastAttempt = attempt === 2;
        if (isLastAttempt) return null;
        continue;
      }
      return JSON.parse(text);
    } catch (error) {
      const isLastAttempt = attempt === 2;
      if (isLastAttempt) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

async function analyzeCustomerMessage(message, context = {}) {
  if (!GEMINI_API_KEY || !message) return null;

  try {
    const normalizedMessage = normalizeMessage(message);
    let parsed = await callGemini(normalizedMessage, context);
    const looksUncertain =
      !parsed ||
      typeof parsed !== "object" ||
      ((parsed.intent === "unknown" || !parsed.intent) && !parsed.item_code && !parsed.item_name);

    if (looksUncertain) {
      const retryPrompt =
        `${normalizedMessage}\n` +
        "Hay dien giai slang/viet tat truoc khi trich xuat JSON.";
      const retried = await callGemini(retryPrompt, context);
      if (retried && typeof retried === "object") {
        parsed = retried;
      }
    }

    if (!parsed || typeof parsed !== "object") return null;

    parsed.intent = normalizeIntent(parsed.intent);

    if (!parsed.intent) {
      parsed.intent = fallbackIntent(normalizedMessage);
    }

    if (!parsed.item_code) {
      const match = findClosestMenuItem(normalizedMessage);
      if (match) {
        parsed.item_code = match.id;
        parsed.item_name = match.name;
      }
    }

    if (!Array.isArray(parsed.topping_codes) || parsed.topping_codes.length === 0) {
      const toppings = extractToppingsFallback(normalizedMessage);
      parsed.topping_codes = toppings.map((item) => item.id);
      parsed.topping_names = toppings.map((item) => item.name);
    }

    if (!Number.isFinite(parsed.quantity)) {
      parsed.quantity = extractQuantityFallback(normalizedMessage);
    }

    return {
      intent: parsed.intent || "unknown",
      item_code: parsed.item_code || null,
      item_name: parsed.item_name || null,
      size: parsed.size || null,
      quantity: Number.isFinite(parsed.quantity) ? parsed.quantity : null,
      topping_codes: Array.isArray(parsed.topping_codes) ? parsed.topping_codes : [],
      topping_names: Array.isArray(parsed.topping_names) ? parsed.topping_names : [],
      confidence: Boolean((parsed.intent && parsed.intent !== "unknown") || parsed.item_code)
    };
  } catch (_error) {
    return null;
  }
}

module.exports = {
  analyzeCustomerMessage
};
