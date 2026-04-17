const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "app.db");
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  customer_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  payos_order_code TEXT UNIQUE,
  payment_status TEXT,
  status TEXT,
  total INTEGER,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_payos_order_code
ON orders(payos_order_code);
`);

function nowIso() {
  return new Date().toISOString();
}

function getSessionByCustomerId(customerId) {
  const row = db
    .prepare("SELECT data FROM sessions WHERE customer_id = ?")
    .get(String(customerId));
  if (!row) return null;
  return JSON.parse(row.data);
}

function saveSession(customerId, sessionData) {
  const ts = nowIso();
  db.prepare(`
    INSERT INTO sessions (customer_id, data, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(customer_id) DO UPDATE SET
      data = excluded.data,
      updated_at = excluded.updated_at
  `).run(String(customerId), JSON.stringify(sessionData), ts);
}

function deleteSession(customerId) {
  db.prepare("DELETE FROM sessions WHERE customer_id = ?").run(String(customerId));
}

function saveOrder(customerId, order) {
  const ts = nowIso();
  const row = db
    .prepare("SELECT created_at FROM orders WHERE order_id = ?")
    .get(String(order.order_id));
  const createdAt = row?.created_at || ts;

  db.prepare(`
    INSERT INTO orders (
      order_id, customer_id, payos_order_code, payment_status, status, total, data, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(order_id) DO UPDATE SET
      customer_id = excluded.customer_id,
      payos_order_code = excluded.payos_order_code,
      payment_status = excluded.payment_status,
      status = excluded.status,
      total = excluded.total,
      data = excluded.data,
      updated_at = excluded.updated_at
  `).run(
    String(order.order_id),
    String(customerId),
    order.payos_order_code ? String(order.payos_order_code) : null,
    order.payment_status || null,
    order.status || null,
    Number(order.total || 0),
    JSON.stringify(order),
    createdAt,
    ts
  );
}

function getOrderByPayOSOrderCode(orderCode) {
  const row = db
    .prepare("SELECT data FROM orders WHERE payos_order_code = ?")
    .get(String(orderCode));
  if (!row) return null;
  return JSON.parse(row.data);
}

function markOrderPaidByPayOSOrderCode(orderCode) {
  const row = db
    .prepare("SELECT order_id, customer_id, data FROM orders WHERE payos_order_code = ?")
    .get(String(orderCode));
  if (!row) return null;

  const order = JSON.parse(row.data);
  order.payment_status = "paid";
  order.status = "confirmed";

  db.prepare(`
    UPDATE orders
    SET payment_status = ?, status = ?, data = ?, updated_at = ?
    WHERE order_id = ?
  `).run("paid", "confirmed", JSON.stringify(order), nowIso(), row.order_id);

  return {
    customerId: row.customer_id,
    order
  };
}

module.exports = {
  getSessionByCustomerId,
  saveSession,
  deleteSession,
  saveOrder,
  getOrderByPayOSOrderCode,
  markOrderPaidByPayOSOrderCode
};

