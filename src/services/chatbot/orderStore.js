const {
  saveOrder,
  getOrderByPayOSOrderCode: getOrderByPayOSOrderCodeFromDb,
  markOrderPaidByPayOSOrderCode: markOrderPaidByPayOSOrderCodeInDb
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

module.exports = {
  registerPayOSOrder,
  persistOrder,
  getOrderByPayOSOrderCode,
  markOrderPaidByPayOSOrderCode
};

