const { formatVnd } = require("../../utils/text");
const { MENU_ITEMS, TOPPINGS } = require("./catalogParser");

function calcItemSubtotal(item) {
  const base = item.unit_price * item.quantity;
  const toppingTotal = (item.toppings || []).reduce((sum, top) => sum + top.unit_price * top.quantity, 0);
  return base + toppingTotal;
}

function calcOrderTotal(cart) {
  return cart.reduce((sum, item) => sum + item.subtotal, 0);
}

function formatMenu() {
  const grouped = MENU_ITEMS.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const lines = ["📋 MENU CỦA SỐP NÈ:", "────────────────────"];
  for (const [category, items] of Object.entries(grouped)) {
    lines.push(`\n${category}:`);
    for (const item of items) {
      lines.push(`- ${item.id} | ${item.name} | M ${formatVnd(item.prices.M)} | L ${formatVnd(item.prices.L)}`);
    }
  }

  lines.push("\nTopping:");
  for (const top of TOPPINGS) {
    lines.push(`- ${top.id} | ${top.name} | ${formatVnd(top.price)}`);
  }
  lines.push("\nĐÂY LÀ MENU CỦA SỐP NÈ. Khách muốn order luôn hay cần sốp tư vấn thêm món hong ạ? 🧋");
  return lines.join("\n");
}

function formatOrderSummary(cart) {
  const lines = ["📋 ĐƠN HÀNG CỦA KHÁCH NEK:", "─────────────────────"];
  cart.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name} - Size ${item.size} x${item.quantity}`);
    if ((item.toppings || []).length > 0) {
      item.toppings.forEach((top) => {
        lines.push(`   + Topping: ${top.name} x${top.quantity} (${formatVnd(top.unit_price * top.quantity)})`);
      });
    } else {
      lines.push("   + Topping: Không");
    }
    lines.push(`   → ${formatVnd(item.subtotal)}`);
    lines.push("");
  });
  lines.push("─────────────────────");
  lines.push(`💰 TỔNG CỘNG: ${formatVnd(calcOrderTotal(cart))}`);
  lines.push("─────────────────────");
  lines.push("Đơn này chuẩn chưa khách iu ơi? ✅");
  return lines.join("\n");
}

function createOrderId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `ORD-${y}${m}${d}-${random}`;
}

function buildOrderJson(session) {
  return {
    order_id: createOrderId(),
    timestamp: new Date().toISOString(),
    customer: {
      name: session.customer.name,
      phone: session.customer.phone,
      address: session.customer.address,
      note: session.customer.note || null
    },
    items: session.cart.map((item) => ({
      item_id: item.item_id,
      name: item.name,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.unit_price,
      toppings: item.toppings || [],
      subtotal: item.subtotal
    })),
    total: calcOrderTotal(session.cart),
    payment_method: session.paymentMethod,
    payment_status: session.paymentStatus,
    status: "confirmed"
  };
}

function toPayOSItems(cart) {
  return cart.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    price: item.unit_price
  }));
}

module.exports = {
  calcItemSubtotal,
  calcOrderTotal,
  formatMenu,
  formatOrderSummary,
  buildOrderJson,
  toPayOSItems
};

