require("dotenv").config();
const express = require("express");
const path = require("node:path");
const fs = require("node:fs/promises");
const {
  handleMessage,
  resetSession,
  formatMenu,
  markOrderPaidByPayOSOrderCode,
  getOrderByPayOSOrderCode
} = require("./services/chatbotService");
const { createTelegramPollingService } = require("./services/telegramPollingService");
const { verifyWebhookPayload, isPayOSConfigured } = require("./services/payosService");
const { paymentReceivedThankYou } = require("./services/chatbot/chatTone");
const { getAllOrders, updateOrderStatus } = require("./services/chatbot/orderStore");
const QRCode = require("qrcode");

const app = express();
app.use(express.json());

function basicAuth(req, res, next) {
  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

  const ADMIN_USER = process.env.ADMIN_USER || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'castea123';

  if (login && password && login === ADMIN_USER && password === ADMIN_PASS) {
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="Castea Admin"');
  res.status(401).send('Xác thực thất bại.');
}

app.use("/static", basicAuth, express.static(path.join(__dirname, "../static")));
app.use("/api/orders", basicAuth);

const PORT = Number(process.env.PORT || 3000);
/** Ảnh menu trong repo — dùng upload trực tiếp lên Telegram khi gửi bằng URL thất bại. */
const MENU_STATIC_FILE = path.join(__dirname, "../static/menu.png");
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_TELEGRAM_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID;
const ADMIN_TELEGRAM_BOT_TOKEN = process.env.ADMIN_TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN;
const TELEGRAM_MODE = (process.env.TELEGRAM_MODE || "webhook").toLowerCase();
const TELEGRAM_DEDUP_TTL_MS = 10 * 60 * 1000;
const processedTelegramMessages = new Map();

function buildTelegramDedupKey(chatId, messageId) {
  if (chatId == null || messageId == null) return null;
  return `${chatId}:${messageId}`;
}

function shouldSkipDuplicateTelegramMessage(chatId, messageId) {
  const key = buildTelegramDedupKey(chatId, messageId);
  if (!key) return false;

  const now = Date.now();
  const expiresAt = processedTelegramMessages.get(key);
  if (expiresAt && expiresAt > now) {
    return true;
  }

  processedTelegramMessages.set(key, now + TELEGRAM_DEDUP_TTL_MS);
  for (const [storedKey, storedExpiresAt] of processedTelegramMessages.entries()) {
    if (storedExpiresAt <= now) {
      processedTelegramMessages.delete(storedKey);
    }
  }

  return false;
}

async function notifyAdminNewOrder(order) {
  if (!ADMIN_TELEGRAM_CHAT_ID || !ADMIN_TELEGRAM_BOT_TOKEN) return;
  const itemsText = (order.items || []).map(item => {
    let text = `- ${item.quantity}x ${item.name} (Size ${item.size})`;
    if (item.toppings && item.toppings.length > 0) {
      text += `\n  + Topping: ${item.toppings.map(t => t.name).join(', ')}`;
    }
    return text;
  }).join("\n");
  
  const paymentMethodText = order.payment_method === 'transfer' ? 'Chuyển khoản' : 'COD';
  
  const msg = `🚨 ĐƠN HÀNG MỚI #${order.order_id}\n` +
              `------------------------\n` +
              `${itemsText}\n` +
              `------------------------\n` +
              `💰 Tổng: ${new Intl.NumberFormat('vi-VN').format(order.total)}đ\n` +
              `💳 Thanh toán: ${paymentMethodText}\n` +
              `🙎 Khách: ${order.customer?.name || ''} - ${order.customer?.phone || ''}\n` +
              `📍 Địa chỉ: ${order.customer?.address || ''}\n` +
              (order.customer?.note ? `📝 Ghi chú: ${order.customer.note}` : '');
              
  try {
    await sendTelegramMessage(ADMIN_TELEGRAM_BOT_TOKEN, ADMIN_TELEGRAM_CHAT_ID, msg);
  } catch (err) {
    console.error("[telegram] gui thong bao admin that bai:", err.message);
  }
}

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
          <li>Admin Dashboard: <a href="/static/dashboard.html">/static/dashboard.html</a> </li>
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
    if (result?.order && result.stage === "FINALIZED") {
      await notifyAdminNewOrder(result.order);
    }
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/orders", (_req, res) => {
  try {
    const orders = getAllOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/orders/:id/status", (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Missing status" });
    }
    const updated = updateOrderStatus(id, status);
    if (!updated) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const messageId = msg?.message_id;
    if (!chatId || !text) {
      return res.sendStatus(200);
    }
    if (shouldSkipDuplicateTelegramMessage(chatId, messageId)) {
      return res.sendStatus(200);
    }

    const result = await handleMessage(String(chatId), String(text));
    if (result?.order && result.stage === "FINALIZED") {
      await notifyAdminNewOrder(result.order);
    }
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

async function sendTelegramPhotoFile(token, chatId, filePath, caption) {
  if (!filePath) return { ok: true };
  let fileBuffer;
  try {
    fileBuffer = await fs.readFile(filePath);
  } catch (_error) {
    return { ok: false, detail: `Khong doc duoc file anh menu: ${filePath}` };
  }

  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) form.append("caption", caption);
  form.append("photo", new Blob([fileBuffer], { type: "image/png" }), "menu.png");

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

async function sendTelegramPhotoByUrl(token, chatId, photoUrl, caption) {
  if (!photoUrl) return { ok: true };
  const telegramUrl = `https://api.telegram.org/bot${token}/sendPhoto`;
  const body = {
    chat_id: chatId,
    photo: photoUrl
  };
  if (caption) body.caption = caption;
  const telegramRes = await fetch(telegramUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
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

  const tg = result?.telegram;
  const menuCaption = tg?.menuPhotoCaption || tg?.photoCaption;

  if (tg?.menu) {
    let sentPhoto = await sendTelegramPhotoFile(token, chatId, MENU_STATIC_FILE, menuCaption);
    if (!sentPhoto.ok && tg.photoFilePath) {
      sentPhoto = await sendTelegramPhotoFile(token, chatId, tg.photoFilePath, menuCaption);
    }
    if (!sentPhoto.ok && tg.photoUrl) {
      sentPhoto = await sendTelegramPhotoByUrl(token, chatId, tg.photoUrl, menuCaption);
    }
    if (!sentPhoto.ok) {
      console.error("[telegram] menu photo failed:", sentPhoto.detail || "");
    }
    if (!sentPhoto.ok && tg.fallbackText) {
      return sendTelegramMessage(token, chatId, tg.fallbackText);
    }
    if (!sentPhoto.ok) return sentPhoto;
  }

  const qrCode = tg?.photoQrCode;
  const qrCaption = tg?.qrPhotoCaption || tg?.photoCaption;
  if (!qrCode) return { ok: true };

  return sendTelegramQrPhoto(token, chatId, qrCode, qrCaption);
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
      const updated = markOrderPaidByPayOSOrderCode(orderCode);
      if (updated?.customerId && TELEGRAM_BOT_TOKEN) {
        try {
          const thankYou = paymentReceivedThankYou(updated.order);
          const sent = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, updated.customerId, thankYou);
          if (!sent.ok) {
            console.error("[payos] gui tin cam on Telegram loi:", sent.detail || "");
          }
          if (ADMIN_TELEGRAM_CHAT_ID && ADMIN_TELEGRAM_BOT_TOKEN) {
            await sendTelegramMessage(ADMIN_TELEGRAM_BOT_TOKEN, ADMIN_TELEGRAM_CHAT_ID, `💸 Đơn hàng #${updated.order.order_id} đã được thanh toán chuyển khoản thành công!`);
          }
        } catch (err) {
          console.error("[payos] gui tin cam on Telegram:", err?.message || err);
        }
      }
      return res.json({
        ok: true,
        paid: Boolean(updated),
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
      onMessage: async (chatId, text, metadata = {}) => {
        if (shouldSkipDuplicateTelegramMessage(chatId, metadata.messageId)) {
          return null;
        }
        const result = await handleMessage(chatId, text);
        if (result?.order && result.stage === "FINALIZED") {
          await notifyAdminNewOrder(result.order);
        }
        return result;
      }
    });
    polling.start();
    console.log("Telegram polling mode dang chay.");
  }
});


