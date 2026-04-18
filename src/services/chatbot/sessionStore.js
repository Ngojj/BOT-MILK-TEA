const {
  getSessionByCustomerId,
  saveSession,
  deleteSession
} = require("../databaseService");
const { STAGE } = require("./constants");

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const sessions = new Map();

function createDefaultSession() {
  return {
    stage: STAGE.GREETING,
    cart: [],
    currentItem: null,
    customer: { name: null, phone: null, address: null, note: null },
    paymentMethod: null,
    paymentStatus: "pending",
    latestOrder: null,
    updatedAt: Date.now()
  };
}

function getSession(customerId) {
  if (!sessions.has(customerId)) {
    const fromDb = getSessionByCustomerId(customerId);
    sessions.set(customerId, fromDb || createDefaultSession());
  }

  const session = sessions.get(customerId);
  if (session && session.updatedAt && (Date.now() - session.updatedAt > SESSION_TTL_MS)) {
    resetSessionData(session);
  }

  return session;
}

function getCachedSession(customerId) {
  return sessions.get(customerId) || null;
}

function persistSession(customerId, session) {
  session.updatedAt = Date.now();
  saveSession(customerId, session);
}

function resetSession(customerId) {
  sessions.delete(customerId);
  deleteSession(customerId);
}

function resetSessionData(session) {
  session.stage = STAGE.GREETING;
  session.cart = [];
  session.currentItem = null;
  session.customer = { name: null, phone: null, address: null, note: null };
  session.paymentMethod = null;
  session.paymentStatus = "pending";
  session.latestOrder = null;
  session.updatedAt = Date.now();
}

module.exports = {
  getSession,
  getCachedSession,
  persistSession,
  resetSession,
  resetSessionData
};

