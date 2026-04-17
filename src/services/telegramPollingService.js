const QRCode = require("qrcode");

function createTelegramPollingService({ token, onMessage, intervalMs = 1500 }) {
  let offset = 0;
  let running = false;
  let loopPromise = null;

  async function pollOnce() {
    const url = `https://api.telegram.org/bot${token}/getUpdates?timeout=20&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[telegram] getUpdates failed:", res.status, detail);
      return;
    }

    const data = await res.json();
    if (!data.ok || !Array.isArray(data.result)) {
      console.error("[telegram] getUpdates invalid response:", JSON.stringify(data));
      return;
    }

    for (const update of data.result) {
      offset = update.update_id + 1;
      const msg = update.message;
      const chatId = msg?.chat?.id;
      const text = msg?.text;
      const messageId = msg?.message_id;
      if (!chatId || !text) continue;

      const result = await onMessage(String(chatId), String(text), {
        source: "polling",
        updateId: update.update_id,
        messageId: messageId != null ? Number(messageId) : null
      });
      if (!result) continue;

      const normalizedResult =
        typeof result === "string"
          ? { reply: result }
          : {
              reply: result.reply || "",
              telegram: result.telegram || null
            };

      const sentText = await sendTelegramMessage(token, chatId, normalizedResult.reply);
      if (!sentText.ok) {
        console.error("[telegram] sendMessage failed:", sentText.status, sentText.detail);
        continue;
      }

      const qrCode = normalizedResult.telegram?.photoQrCode;
      const caption = normalizedResult.telegram?.photoCaption;
      if (!qrCode) continue;

      const sentPhoto = await sendTelegramQrPhoto(token, chatId, qrCode, caption);
      if (!sentPhoto.ok) {
        console.error("[telegram] sendPhoto failed:", sentPhoto.status, sentPhoto.detail);
      }
    }
  }

  async function runLoop() {
    while (running) {
      try {
        await pollOnce();
      } catch (error) {
        console.error("[telegram] polling error:", error?.message || error);
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  function start() {
    if (running) return;
    running = true;

    fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`)
      .catch((error) => console.error("[telegram] deleteWebhook failed:", error?.message || error));

    loopPromise = runLoop();
  }

  async function stop() {
    running = false;
    await loopPromise;
    loopPromise = null;
  }

  return { start, stop };
}

async function sendTelegramMessage(token, chatId, text) {
  if (!text) return { ok: true };

  const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });

  if (!sendRes.ok) {
    return {
      ok: false,
      status: sendRes.status,
      detail: await sendRes.text().catch(() => "")
    };
  }
  return { ok: true, status: 200 };
}

async function sendTelegramQrPhoto(token, chatId, qrCode, caption) {
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

  const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: form
  });

  if (!sendRes.ok) {
    return {
      ok: false,
      status: sendRes.status,
      detail: await sendRes.text().catch(() => "")
    };
  }
  return { ok: true, status: 200 };
}

module.exports = {
  createTelegramPollingService
};
