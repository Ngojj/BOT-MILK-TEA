const { PayOS } = require("@payos/node");

const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID;
const PAYOS_API_KEY = process.env.PAYOS_API_KEY;
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY;
const PAYOS_RETURN_URL = process.env.PAYOS_RETURN_URL || "http://localhost:3000/payment/success";
const PAYOS_CANCEL_URL = process.env.PAYOS_CANCEL_URL || "http://localhost:3000/payment/cancel";

const payos =
  PAYOS_CLIENT_ID && PAYOS_API_KEY && PAYOS_CHECKSUM_KEY
    ? new PayOS({
        clientId: PAYOS_CLIENT_ID,
        apiKey: PAYOS_API_KEY,
        checksumKey: PAYOS_CHECKSUM_KEY
      })
    : null;

function isPayOSConfigured() {
  return Boolean(payos);
}

function createPayOSOrderCode() {
  const ts = Date.now();
  const suffix = Math.floor(Math.random() * 90 + 10);
  return Number(`${ts}${suffix}`.slice(-13));
}

async function createPaymentLink({
  orderCode,
  amount,
  description,
  items,
  buyerName,
  buyerPhone,
  buyerAddress
}) {
  if (!payos) {
    throw new Error("PayOS chua duoc cau hinh");
  }

  return payos.paymentRequests.create({
    orderCode,
    amount,
    description: String(description || "Thanh toan don hang").slice(0, 25),
    returnUrl: PAYOS_RETURN_URL,
    cancelUrl: PAYOS_CANCEL_URL,
    items: (items || []).map((it) => ({
      name: String(it.name).slice(0, 25),
      quantity: it.quantity,
      price: it.price
    })),
    buyerName: buyerName || undefined,
    buyerPhone: buyerPhone || undefined,
    buyerAddress: buyerAddress || undefined
  });
}

async function verifyWebhookPayload(payload) {
  if (!payos) throw new Error("PayOS chua duoc cau hinh");
  return payos.webhooks.verify(payload);
}

module.exports = {
  isPayOSConfigured,
  createPayOSOrderCode,
  createPaymentLink,
  verifyWebhookPayload
};
