const {
  saveOrder,
  getOrderByPayOSOrderCode: getOrderByPayOSOrderCodeFromDb,
  markOrderPaidByPayOSOrderCode: markOrderPaidByPayOSOrderCodeInDb,
  getAllOrders: getAllOrdersFromDb,
  updateOrderStatus: updateOrderStatusInDb
} = require("../databaseService");

function registerPayOSOrder(_orderCode, customerId, order) {
  saveOrder(customerId, order);
}

function persistOrder(customerId, order) {
  saveOrder(customerId, order);
}

function getOrderByPayOSOrderCode(orderCode) {
  return getOrderByPayOSOrderCodeFromDb(orderCode);
}

function markOrderPaidByPayOSOrderCode(orderCode) {
  return markOrderPaidByPayOSOrderCodeInDb(orderCode);
}

function getAllOrders() {
  return getAllOrdersFromDb();
}

function updateOrderStatus(orderId, status) {
  return updateOrderStatusInDb(orderId, status);
}

module.exports = {
  registerPayOSOrder,
  persistOrder,
  getOrderByPayOSOrderCode,
  markOrderPaidByPayOSOrderCode,
  getAllOrders,
  updateOrderStatus
};

