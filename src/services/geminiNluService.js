const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

function buildSystemInstruction(context = {}) {
  const stage = context.stage || "unknown";
  const stageHints = {
    GREETING: "Thuong nhan intent menu hoac order.",
    COLLECTING_ITEM: "Tap trung trich xuat item_name/item_code/size/quantity/topping.",
    ASK_ADD_MORE: "Tap trung phan biet order tiep tuc hay deny de chot don.",
    CONFIRM_ORDER: "Tap trung phan biet confirm hoac deny.",
    COLLECT_CUSTOMER_NOTE: "Neu nguoi dung bao khong can ghi chu thi intent=deny.",
    COLLECT_PAYMENT: "Hieu thanh toan COD/chuyen khoan."
  };
  const stageHintLine = stageHints[stage] || "Uu tien suy luan theo nghia trong ngu canh hien tai.";
  return (
    "Ban la bo phan phan tich tin nhan dat do uong. " +
    `Ngu canh hien tai: stage=${stage}. ` +
    `${stageHintLine} ` +
    "Tra ve DUY NHAT JSON co cac truong: " +
    "intent(menu|order|confirm|deny|provide_info|unknown), " +
    "item_code, item_name, size(M|L|null), quantity(number|null), topping_codes(array), topping_names(array). " +
    "Khong them van ban khac ngoai JSON. " +
    "Phan loai intent theo nghia, uu tien ngu canh stage. " +
    "Can hieu tieng viet tu nhien, viet tat, slang va typo nhe. " +
    "Vi du ten mon: 'cf den', 'ca phe den', 'cafe den' deu la cung mot mon. " +
    "Viet tat thuong gap: cf=ca phe, kh=khong, ck=chuyen khoan. " +
    "Cum tu thuong gap: 'giao tan noi' nghia la giao hang, khong phai tu den lay. " +
    "Vi du xac nhan: 'roi', 'ok roi', 'chuan', 'duoc' => confirm. " +
    "Vi du tu choi/khong tiep tuc: 'khong can', 'khong them', 'thoi' => deny. " +
    "Neu stage dang hoi topping/ghi chu/them mon ma nguoi dung nhan 'kh' hoac 'k' thi uu tien intent=deny. " +
    "Neu nhan ra ten mon thi phai tra ve item_name hoac item_code phu hop, khong de unknown. " +
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

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
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
    } catch (error) {
      const isLastAttempt = attempt === 1;
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
    let parsed = await callGemini(message, context);
    const looksUncertain =
      !parsed ||
      typeof parsed !== "object" ||
      ((parsed.intent === "unknown" || !parsed.intent) && !parsed.item_code && !parsed.item_name);

    // Let Gemini re-interpret short/slang messages before fallback rules handle them.
    if (looksUncertain) {
      const retryPrompt =
        `${message}\n` +
        "Hay dien giai viet tat/slang/loi go pho bien sang tieng viet day du roi moi trich xuat JSON.";
      const retried = await callGemini(retryPrompt, context);
      if (retried && typeof retried === "object") {
        parsed = retried;
      }
    }

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
