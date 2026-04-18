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
  return text
    .replace(/\bchan\s+trau\b/g, "tran chau")
    .replace(/\btran\s+trau\b/g, "tran chau")
    .replace(/\bchan\s+chau\b/g, "tran chau")
    .trim();
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

function mapLineItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const size = raw.size === "M" || raw.size === "L" ? raw.size : null;
  // Some NLU outputs omit quantity for "mot/một ..."; default to 1 once item is identified.
  const quantity = Number.isFinite(raw.quantity) && raw.quantity > 0 ? Number(raw.quantity) : 1;
  const code = normalizeText(String(raw.item_code || ""));
  const name = normalizeText(String(raw.item_name || ""));
  const matched =
    MENU_ITEMS.find((item) => normalizeText(item.id) === code) ||
    MENU_ITEMS.find((item) => {
      const normalizedName = normalizeText(item.name);
      return normalizedName.includes(name) || name.includes(normalizedName);
    });
  if (!matched) return null;
  return {
    item_code: matched.id,
    item_name: matched.name,
    size,
    quantity,
    topping_codes: Array.isArray(raw.topping_codes) ? raw.topping_codes : [],
    topping_names: Array.isArray(raw.topping_names) ? raw.topping_names : []
  };
}

function normalizeLineItems(rawLineItems) {
  if (!Array.isArray(rawLineItems)) return [];
  const mapped = rawLineItems.map(mapLineItem).filter(Boolean);
  const merged = [];
  for (const item of mapped) {
    if (!item.size) continue;
    const existing = merged.find((it) => it.item_code === item.item_code && it.size === item.size);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      merged.push({ ...item });
    }
  }
  return merged;
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
  const extractionRules =
    "QUY TAC TACH LINE_ITEMS: " +
    "1) Moi mon + size la 1 dong rieng. " +
    "2) Neu cau co nhieu mon, phai tra du tung mon trong line_items. " +
    "3) Neu nguoi dung noi mot size chung (vi du: 'size M') thi ap dung cho cac mon chua co size rieng. " +
    "4) Neu cau chia size (vi du: '2 size L 1 size M') thi phai tao it nhat 2 dong cho cung mon. " +
    "5) Khong tu suy dien mon ngoai menu; map ve mon gan nhat hop le. " +
    "6) Neu chua chac, van tra line_items voi phan da chac va de null cho truong chua du thong tin. " +
    "7) Topping cua mon nao phai de chinh xac vao topping_names cua mon do trong line_items.";
  const examples =
    "VI DU JSON MONG MUON: " +
    "Input: '2 ca phe sua va 1 ca phe den size M' => " +
    '{"intent":"order","line_items":[{"item_code":"CF02","item_name":"Cà Phê Sữa","size":"M","quantity":2},{"item_code":"CF01","item_name":"Cà Phê Đen","size":"M","quantity":1}]}. ' +
    "Input: '3 ca phe sua, 2 size L 1 size M' => " +
    '{"intent":"order","line_items":[{"item_code":"CF02","item_name":"Cà Phê Sữa","size":"L","quantity":2},{"item_code":"CF02","item_name":"Cà Phê Sữa","size":"M","quantity":1}]}. ' +
    "Input: '1 tra sua size M va 1 cafe size L kem tuoi' => " +
    '{"intent":"order","line_items":[{"item_code":"TS01","item_name":"Trà Sữa","size":"M","quantity":1},{"item_code":"CF01","item_name":"Cà Phê","size":"L","quantity":1,"topping_names":["Kem Tươi"]}]}. ' +
    "Input: 'khong can topping' => " +
    '{"intent":"deny","topping_codes":[],"topping_names":[]}.';

  return (
    "Ban la bo phan phan tich tin nhan dat do uong. " +
    `Stage hien tai: ${stage}. ${stageHintLine} ` +
    "Can hieu tieng viet tu nhien, viet tat, slang va typo. " +
    "Viet tat thuong gap: cf=ca phe, ts=tra sua, ttg=tra trai cay, dx=da xay, kh=khong, ck=chuyen khoan. " +
    `Danh sach mon hop le: ${menuItems}. ` +
    `Danh sach topping hop le: ${toppings}. ` +
    "Tra ve DUY NHAT JSON schema: " +
    "{intent, item_code, item_name, size, quantity, topping_codes, topping_names, " +
    "line_items: [{item_code, item_name, size, quantity, topping_codes, topping_names}]}. " +
    "Neu co nhieu mon khac nhau, dien day du vao line_items. " +
    "item_code/item_name/size/quantity la mon DAU TIEN hoac mon chinh. " +
    `${extractionRules} ` +
    `${examples} ` +
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

    const lineItems = normalizeLineItems(parsed.line_items);
    if (lineItems.length === 0 && parsed.item_code) {
      lineItems.push({
        item_code: parsed.item_code,
        item_name: parsed.item_name,
        size: parsed.size === "M" || parsed.size === "L" ? parsed.size : null,
        quantity: Number.isFinite(parsed.quantity) && parsed.quantity > 0 ? parsed.quantity : null
      });
    }

    return {
      intent: parsed.intent || "unknown",
      item_code: parsed.item_code || null,
      item_name: parsed.item_name || null,
      size: parsed.size || null,
      quantity: Number.isFinite(parsed.quantity) ? parsed.quantity : null,
      topping_codes: Array.isArray(parsed.topping_codes) ? parsed.topping_codes : [],
      topping_names: Array.isArray(parsed.topping_names) ? parsed.topping_names : [],
      line_items: lineItems,
      confidence: Boolean((parsed.intent && parsed.intent !== "unknown") || parsed.item_code)
    };
  } catch (_error) {
    return null;
  }
}

module.exports = {
  analyzeCustomerMessage
};
