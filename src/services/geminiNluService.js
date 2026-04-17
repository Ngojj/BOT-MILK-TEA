const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

function buildSystemInstruction(context = {}) {
  const stage = context.stage || "unknown";
  return (
    "Ban la bo phan phan tich tin nhan dat do uong. " +
    `Ngu canh hien tai: stage=${stage}. ` +
    "Tra ve DUY NHAT JSON co cac truong: " +
    "intent(menu|order|confirm|deny|provide_info|unknown), " +
    "item_code, item_name, size(M|L|null), quantity(number|null), topping_codes(array), topping_names(array). " +
    "Khong them van ban khac ngoai JSON. " +
    "Phan loai intent theo nghia, uu tien ngu canh stage. " +
    "Vi du intent=confirm: dong y, dung, oke, okela, chuan, xac nhan, yup. " +
    "Vi du intent=deny: khong, chua dung, khong them, thoi, no."
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) return null;

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function analyzeCustomerMessage(message, context = {}) {
  if (!GEMINI_API_KEY || !message) return null;

  try {
    const parsed = await callGemini(message, context);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      intent: parsed.intent || "unknown",
      item_code: parsed.item_code || null,
      item_name: parsed.item_name || null,
      size: parsed.size || null,
      quantity: Number.isFinite(parsed.quantity) ? parsed.quantity : null,
      topping_codes: Array.isArray(parsed.topping_codes) ? parsed.topping_codes : [],
      topping_names: Array.isArray(parsed.topping_names) ? parsed.topping_names : []
    };
  } catch (_error) {
    return null;
  }
}

module.exports = {
  analyzeCustomerMessage
};
