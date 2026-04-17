function oneOf(options) {
  return options[Math.floor(Math.random() * options.length)];
}

function askSize() {
  return oneOf([
    "Mình lên món ngay nè, bạn chốt size M hoặc L giúp mình 🧋",
    "Món này bạn chọn size M hay L để mình làm liền nha.",
    "Cho mình xin size (M/L), mình thêm vào đơn ngay cho bạn."
  ]);
}

function askQuantity() {
  return oneOf([
    "Bạn lấy mấy ly nhé? 👌",
    "Số lượng bạn muốn là bao nhiêu ạ?",
    "Cho mình xin số lượng giúp bạn nha."
  ]);
}

function askToppingMissing() {
  return oneOf([
    "Bạn muốn thêm topping gì cho món này không ạ?",
    "Bạn dặn topping giúp mình nhé, mình cập nhật ngay cho bạn.",
    "Món này bạn muốn thêm topping gì nữa nè?"
  ]);
}

function itemAdded(last) {
  return oneOf([
    `Mình đã thêm ${last.name} size ${last.size} x${last.quantity} ✅ Bạn muốn thêm món gì nữa cứ nhắn tiếp giúp mình nha.`,
    `${last.name} size ${last.size} x${last.quantity} đã vào giỏ rồi nè. Bạn cần thêm món nào mình lên tiếp luôn.`,
    `Okie, ${last.name} size ${last.size} x${last.quantity} đã được thêm. Mình đợi món tiếp theo của bạn nhé.`
  ]);
}

function askToppingClarify() {
  return oneOf([
    "Mình chưa rõ topping bạn muốn thêm cho món vừa rồi, bạn nhắn lại giúp mình nhé.",
    "Bạn nói rõ giúp mình topping cần thêm để mình cập nhật chuẩn hơn nha.",
    "Mình chưa bắt được tên topping, bạn nhắn lại giúp mình một lần nữa nhé."
  ]);
}

function toppingUpdated(lastItem) {
  return oneOf([
    `Okie, mình đã cập nhật topping cho ${lastItem.name} size ${lastItem.size} x${lastItem.quantity}. Bạn muốn thêm món khác không? (có/không)`,
    `Mình thêm topping cho ${lastItem.name} xong rồi nha. Bạn có muốn gọi thêm món không? (có/không)`,
    `Đã chỉnh topping cho ${lastItem.name} rồi ✅ Bạn muốn thêm món nữa không? (có/không)`
  ]);
}

function greetingOpen() {
  return oneOf([
    "Chào bạn 😊 Bạn muốn xem menu hay đặt món luôn nè?",
    "Hello bạn ơi, mình sẵn sàng nhận đơn. Bạn muốn xem menu hay gọi món luôn?",
    "Mình ở đây nè 👋 Bạn muốn xem menu hay đặt món luôn cho nhanh?"
  ]);
}

function askItemName() {
  return oneOf([
    "Bạn gọi món nào thì nhắn mình tên món giúp mình nha.",
    "Cho mình biết món bạn muốn gọi để mình lên đơn nhé.",
    "Bạn muốn dùng món gì, nhắn mình để mình thêm vào đơn liền nè."
  ]);
}

function askAddMore() {
  return oneOf([
    "Bạn muốn thêm món nào nữa thì nhắn luôn giúp mình nhé.",
    "Mình đang đợi món tiếp theo của bạn nè.",
    "Nếu cần gọi thêm, bạn nhắn món tiếp theo để mình lên đơn luôn nha."
  ]);
}

function askConfirmOrder() {
  return oneOf([
    "Bạn xem giúp mình, nếu ổn thì nhắn `đúng`, cần sửa thì nhắn `chưa đúng` nha.",
    "Mình gửi bạn bản chốt đơn rồi nè: ok thì nhắn `đúng`, muốn chỉnh thì nhắn `chưa đúng`.",
    "Mình chờ bạn xác nhận đơn: nhắn `đúng` để tiếp tục, hoặc `chưa đúng` để mình sửa ngay."
  ]);
}

function askName() {
  return oneOf([
    "Mình xin tên người nhận để chốt đơn cho chuẩn nhé 😊",
    "Bạn gửi mình tên người nhận giúp mình nha.",
    "Cho mình tên người nhận, mình đi tiếp bước xác nhận liền nè."
  ]);
}

function askPhone() {
  return oneOf([
    "Bạn gửi mình số điện thoại nhận hàng giúp mình nhé 📱",
    "Cho mình xin SĐT người nhận để tài xế liên hệ nhanh nha.",
    "Mình cần số điện thoại người nhận, bạn nhắn giúp mình là xong bước này."
  ]);
}

function invalidPhone() {
  return oneOf([
    "Số điện thoại này chưa hợp lệ, bạn kiểm tra lại giúp mình nhé.",
    "Mình thấy SĐT hơi sai định dạng, bạn gửi lại giúp mình nha.",
    "SĐT chưa đúng rồi, bạn nhập lại giúp mình nhé."
  ]);
}

function askAddress() {
  return oneOf([
    "Bạn muốn giao tận nơi hay tự đến lấy để mình chuẩn bị đúng giúp bạn ạ?",
    "Mình nhận cả giao tận nơi và tự lấy, bạn cho mình biết cách nhận hàng nhé.",
    "Bạn chọn giúp mình hình thức nhận hàng: giao tận nơi hay ghé lấy tại quán."
  ]);
}

function askAddressRetry() {
  return oneOf([
    "Mình cần địa chỉ rõ hơn để giao đúng chỗ, bạn gửi lại giúp mình nhé.",
    "Địa chỉ hơi ngắn nên mình chưa chốt giao được, bạn bổ sung chi tiết hơn giúp mình nha.",
    "Bạn gửi lại địa chỉ cụ thể hơn một chút để mình lên đơn giao chính xác nhé."
  ]);
}

function askNote() {
  return oneOf([
    "Bạn dặn thêm giúp mình nhé (ví dụ: ít đường, ít đá, dị ứng...).",
    "Bạn có lưu ý gì cho quán cứ nhắn luôn, mình ghi nhận đầy đủ cho bạn.",
    "Mình nhận ghi chú ở bước này, bạn chia sẻ thêm để quán làm đúng ý nha."
  ]);
}

function askPayment() {
  return oneOf([
    "Bạn muốn thanh toán khi nhận hàng hay chuyển khoản trước ạ? 💳",
    "Mình qua bước thanh toán nè, bạn cho mình chọn thanh toán giúp mình nhé.",
    "Đến bước thanh toán rồi, bạn chọn cách nào tiện cho bạn nhất nha."
  ]);
}

function askPaymentChoice() {
  return oneOf([
    "Mình chưa xác định được hình thức thanh toán, bạn nhắn lại giúp mình nhé.",
    "Bạn cho mình biết bạn muốn thanh toán khi nhận hàng hay chuyển khoản nha.",
    "Mình cần xác nhận lại cách thanh toán để chốt đơn cho bạn."
  ]);
}

function resetDone() {
  return oneOf([
    "Mình đã reset phiên đặt hàng cho bạn. Bạn muốn xem menu hay đặt món luôn ạ? 😊",
    "Xong rồi nha, mình đã làm mới đơn. Bạn muốn xem menu hay gọi món luôn?",
    "Mình đã reset xong. Bây giờ bạn muốn xem menu hay đặt món luôn nè?"
  ]);
}

function readyNewOrder() {
  return oneOf([
    "Mình sẵn sàng nhận đơn mới. Bạn muốn xem menu hay đặt món luôn ạ? 😊",
    "Ok nè, mình quay về đơn mới rồi. Bạn muốn xem menu hay gọi luôn?",
    "Mình đã sẵn sàng cho đơn mới. Bạn muốn bắt đầu từ menu hay gọi món luôn?"
  ]);
}

function cancelDone() {
  return oneOf([
    "Mình đã hủy đơn hiện tại cho bạn. Khi cần đặt lại, bạn nhắn `menu` hoặc tên món nhé.",
    "Đã hủy đơn xong rồi nha. Lúc nào bạn muốn đặt lại thì nhắn `menu` hoặc tên món giúp mình.",
    "Mình hủy đơn giúp bạn rồi. Bạn muốn đặt lại thì gọi mình bất cứ lúc nào nhé."
  ]);
}

function unknown() {
  return oneOf([
    "Mình chưa hiểu ý bạn lắm, bạn nhắn lại giúp mình nhé.",
    "Mình chưa bắt được ý đó, bạn nói lại ngắn gọn giúp mình nha.",
    "Cho mình xin lại câu này theo cách khác một chút nhé, để mình hỗ trợ đúng hơn."
  ]);
}

function paymentCreatedPayOS(order) {
  return oneOf([
    `Mình tạo thanh toán PayOS cho đơn ${order.order_id} xong rồi nè ✅`,
    `Ok bạn ơi, link PayOS cho đơn ${order.order_id} đã sẵn sàng ✅`,
    `Mình đã tạo thanh toán PayOS cho đơn ${order.order_id}, bạn quét là thanh toán được ngay ✅`
  ]);
}

function payosCreateFailed(orderId) {
  return oneOf([
    `Mình đã xác nhận đơn ${orderId}, nhưng hiện chưa tạo được QR PayOS.`,
    `Đơn ${orderId} mình đã nhận rồi, nhưng lúc này chưa khởi tạo được PayOS.`,
    `Mình đã chốt đơn ${orderId}, nhưng đang lỗi tạo QR PayOS tạm thời.`
  ]);
}

function orderConfirmed({ orderId, totalFormatted, paymentMethod, isPickup }) {
  const deliveryLine = isPickup ? "Bạn ghé lấy giúp mình khi tiện nha." : "Mình sẽ ưu tiên chuẩn bị và giao sớm cho bạn.";
  if (paymentMethod === "COD") {
    return oneOf([
      `Mình chốt đơn thành công rồi nha ✅\nMã đơn: ${orderId}\nTổng tiền: ${totalFormatted}\nThanh toán: COD\n${deliveryLine}`,
      `Đơn của bạn đã được xác nhận ✅\nMã đơn: ${orderId}\nTổng: ${totalFormatted}\nHình thức: COD\n${deliveryLine}`,
      `Okie, mình nhận đơn rồi ✅\nMã đơn: ${orderId}\nTổng tiền: ${totalFormatted}\nThanh toán khi nhận (COD)\n${deliveryLine}`
    ]);
  }

  return oneOf([
    `Mình chốt đơn thành công rồi nha ✅\nMã đơn: ${orderId}\nTổng tiền: ${totalFormatted}\nThanh toán: chuyển khoản\n${deliveryLine}`,
    `Đơn của bạn đã được xác nhận ✅\nMã đơn: ${orderId}\nTổng: ${totalFormatted}\nHình thức: chuyển khoản\n${deliveryLine}`,
    `Okie, mình nhận đơn rồi ✅\nMã đơn: ${orderId}\nTổng tiền: ${totalFormatted}\nThanh toán: chuyển khoản\n${deliveryLine}`
  ]);
}

module.exports = {
  askSize,
  askQuantity,
  askToppingMissing,
  itemAdded,
  askToppingClarify,
  toppingUpdated,
  greetingOpen,
  askItemName,
  askAddMore,
  askConfirmOrder,
  askName,
  askPhone,
  invalidPhone,
  askAddress,
  askAddressRetry,
  askNote,
  askPayment,
  askPaymentChoice,
  resetDone,
  readyNewOrder,
  cancelDone,
  unknown,
  paymentCreatedPayOS,
  payosCreateFailed,
  orderConfirmed
};
