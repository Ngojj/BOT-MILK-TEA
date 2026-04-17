require("dotenv").config();
const express = require("express");
const {
  handleMessage,
  resetSession,
  formatMenu,
  markOrderPaidByPayOSOrderCode,
  getOrderByPayOSOrderCode
} = require("./services/chatbotService");
const { createTelegramPollingService } = require("./services/telegramPollingService");
const { verifyWebhookPayload, isPayOSConfigured } = require("./services/payosService");
const QRCode = require("qrcode");

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_MODE = (process.env.TELEGRAM_MODE || "webhook").toLowerCase();

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "milk-tea-chatbot-backend", telegramMode: TELEGRAM_MODE });
});

app.get("/", (_req, res) => {
  res.type("html").send(`
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Milk Tea Chatbot Backend</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; line-height: 1.5; }
          code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; }
          a { color: #0b57d0; }
        </style>
      </head>
      <body>
        <h1>Milk Tea Chatbot Backend dang chay</h1>
        <p>Server nay la backend API. Khach nhan tin tren Telegram se duoc tra loi tu dong.</p>
        <ul>
          <li>Health check: <a href="/health">/health</a></li>
          <li>Menu (JSON): <a href="/api/menu">/api/menu</a></li>
        </ul>
        <p>Dung <code>POST /api/chat</code> de test bang API.</p>
      </body>
    </html>
  `);
});

app.get("/api/menu", (_req, res) => {
  res.json({ menuText: formatMenu() });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { customerId, message } = req.body || {};
    if (!customerId || !message) {
      return res.status(400).json({ error: "Thieu customerId hoac message" });
    }
    const result = await handleMessage(String(customerId), String(message));
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/session/reset", (req, res) => {
  const { customerId } = req.body || {};
  if (!customerId) {
    return res.status(400).json({ error: "Thieu customerId" });
  }
  resetSession(String(customerId));
  return res.json({ ok: true });
});

app.post("/webhooks/telegram", async (req, res) => {
  try {
    const msg = req.body?.message;
    const chatId = msg?.chat?.id;
    const text = msg?.text;
    if (!chatId || !text) {
      return res.sendStatus(200);
    }

    const result = await handleMessage(String(chatId), String(text));
    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({
        error: "Chua cau hinh TELEGRAM_BOT_TOKEN",
        replyPreview: result.reply
      });
    }

    const telegramRes = await sendTelegramResult({
      token: TELEGRAM_BOT_TOKEN,
      chatId,
      result
    });

    if (!telegramRes.ok) {
      return res.status(502).json({ error: "Khong gui duoc tin nhan Telegram", detail: telegramRes.detail });
    }
    return res.sendStatus(200);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

async function sendTelegramMessage(token, chatId, text) {
  if (!text) return { ok: true };
  const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
  const telegramRes = await fetch(telegramUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  if (!telegramRes.ok) {
    return {
      ok: false,
      detail: await telegramRes.text().catch(() => "")
    };
  }
  return { ok: true };
}

async function sendTelegramQrPhoto(token, chatId, qrCode, caption) {
  if (!qrCode) return { ok: true };

  const pngBuffer = await QRCode.toBuffer(qrCode, {
    errorCorrectionLevel: "M",
    type: "png",
    margin: 2,
    width: 480
  });

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption || "QR thanh toán");
  form.append("photo", new Blob([pngBuffer], { type: "image/png" }), "payos-qr.png");

  const telegramUrl = `https://api.telegram.org/bot${token}/sendPhoto`;
  const telegramRes = await fetch(telegramUrl, {
    method: "POST",
    body: form
  });

  if (!telegramRes.ok) {
    return {
      ok: false,
      detail: await telegramRes.text().catch(() => "")
    };
  }
  return { ok: true };
}

async function sendTelegramResult({ token, chatId, result }) {
  const textResult = await sendTelegramMessage(token, chatId, result?.reply || "");
  if (!textResult.ok) return textResult;

  const qrCode = result?.telegram?.photoQrCode;
  const caption = result?.telegram?.photoCaption;
  if (!qrCode) return { ok: true };

  return sendTelegramQrPhoto(token, chatId, qrCode, caption);
}

app.post("/webhooks/payos", async (req, res) => {
  try {
    if (!isPayOSConfigured()) {
      return res.status(503).json({ error: "PayOS chưa cấu hình" });
    }

    const webhookData = await verifyWebhookPayload(req.body);
    const orderCode = webhookData?.orderCode;
    const code = webhookData?.code;

    if (!orderCode) {
      return res.status(400).json({ error: "Thiếu orderCode trong webhook" });
    }

    if (code === "00") {
      const updatedOrder = markOrderPaidByPayOSOrderCode(orderCode);
      return res.json({
        ok: true,
        paid: Boolean(updatedOrder),
        orderCode: Number(orderCode)
      });
    }

    return res.json({
      ok: true,
      paid: false,
      orderCode: Number(orderCode),
      code
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Webhook PayOS không hợp lệ" });
  }
});

app.get("/api/payments/qr/:orderCode.png", async (req, res) => {
  try {
    const { orderCode } = req.params;
    const order = getOrderByPayOSOrderCode(orderCode);
    if (!order || !order.payos_qr_code) {
      return res.status(404).json({ error: "Không tìm thấy QR cho orderCode này" });
    }

    const pngBuffer = await QRCode.toBuffer(order.payos_qr_code, {
      errorCorrectionLevel: "M",
      type: "png",
      margin: 2,
      width: 360
    });
    res.setHeader("Content-Type", "image/png");
    return res.send(pngBuffer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Chatbot backend dang chay tai http://localhost:${PORT}`);

  if (TELEGRAM_MODE === "polling" && TELEGRAM_BOT_TOKEN) {
    const polling = createTelegramPollingService({
      token: TELEGRAM_BOT_TOKEN,
      onMessage: async (chatId, text) => {
        return handleMessage(chatId, text);
      }
    });
    polling.start();
    console.log("Telegram polling mode dang chay.");
  }
});


