function oneOf(options) {
  return options[Math.floor(Math.random() * options.length)];
}

function askSize() {
  return oneOf([
    "Bạn muốn size M hay L nè? 🧋",
    "Món này bạn lấy size M hay L ạ?",
    "Cho mình xin size giúp bạn: M hay L?"
  ]);
}

function askQuantity() {
  return oneOf([
    "Bạn lấy mấy ly nhé? Ví dụ `2 ly` 👌",
    "Số lượng bạn muốn là bao nhiêu ạ?",
    "Cho mình xin số lượng giúp bạn nha."
  ]);
}

function askToppingMissing() {
  return oneOf([
    "Bạn muốn thêm topping nào không? Nếu có, nhắn như `thêm TOP04` hoặc `thêm thạch xanh`. Nếu không thì nhắn `không topping` nhé.",
    "Bạn có thêm topping gì không nè? Ví dụ `thêm thạch xanh`, còn không thì nhắn `không topping` giúp mình.",
    "Mình thêm topping luôn cho bạn nha? Nếu không thêm thì nhắn `không topping`."
  ]);
}

function itemAdded(last) {
  return oneOf([
    `Mình thêm ${last.name} size ${last.size} x${last.quantity} rồi nha. Bạn muốn thêm món nữa không? (có/không)`,
    `Đã lên đơn ${last.name} size ${last.size} x${last.quantity} ✅ Bạn có muốn thêm món khác không? (có/không)`,
    `${last.name} size ${last.size} x${last.quantity} đã được thêm. Mình thêm món nữa cho bạn không? (có/không)`
  ]);
}

function askToppingClarify() {
  return oneOf([
    "Mình chưa rõ topping bạn muốn thêm cho món vừa rồi. Bạn nhắn giúp mình kiểu `thêm TOP04` hoặc `thêm thạch xanh` nhé.",
    "Bạn nói rõ topping giúp mình nha, ví dụ `thêm TOP04` hoặc `thêm thạch xanh`.",
    "Mình chưa bắt được tên topping, bạn nhắn lại ngắn gọn kiểu `thêm thạch xanh` giúp mình nhé."
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
    "Bạn nhắn tên món hoặc mã món giúp mình nhé (ví dụ: TS01).",
    "Cho mình xin tên món/mã món bạn muốn gọi nha.",
    "Bạn chọn món giúp mình bằng tên hoặc mã (ví dụ: TS01) nhé."
  ]);
}

function askAddMore() {
  return oneOf([
    "Bạn muốn thêm món khác không ạ? Trả lời `có` hoặc `không` nhé.",
    "Mình thêm tiếp món nữa cho bạn không? (`có`/`không`)",
    "Bạn có muốn gọi thêm món nào nữa không? (`có` hoặc `không`)"
  ]);
}

function askConfirmOrder() {
  return oneOf([
    "Bạn xem giúp mình: đơn này ổn chưa nè? (đúng/chưa đúng)",
    "Mình chốt đơn này luôn được chưa bạn? (đúng/chưa đúng)",
    "Đơn này đúng ý bạn chưa ạ? (đúng/chưa đúng)"
  ]);
}

function askName() {
  return oneOf([
    "Cho mình xin tên người nhận giúp bạn nhé 😊",
    "Mình xin tên người nhận để chốt đơn nha.",
    "Bạn cho mình tên người nhận được không ạ?"
  ]);
}

function askPhone() {
  return oneOf([
    "Bạn cho mình xin số điện thoại nhận hàng nhé 📱",
    "Cho mình xin SĐT người nhận giúp bạn nha.",
    "Mình cần số điện thoại để xác nhận đơn, bạn gửi giúp mình nhé."
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
    "Bạn nhận giao tận nơi hay tự đến lấy ạ? Nếu giao tận nơi, bạn gửi địa chỉ giúp mình.",
    "Bạn muốn giao tận nơi hay tự đến lấy nè? Nếu giao thì nhắn địa chỉ giúp mình nhé.",
    "Mình giao tận nơi hoặc bạn ghé lấy đều được. Nếu giao, bạn gửi địa chỉ giúp mình nha."
  ]);
}

function askAddressRetry() {
  return oneOf([
    "Mình chưa nhận được địa chỉ giao hàng rõ ràng. Bạn gửi lại giúp mình theo dạng `số nhà, đường, phường/xã, quận/huyện` nhé.",
    "Địa chỉ này chưa đủ rõ để giao hàng. Bạn ghi lại giúp mình kiểu `số nhà, đường, phường/xã, quận/huyện` nha.",
    "Mình cần địa chỉ cụ thể hơn một chút để giao đúng chỗ. Bạn gửi lại giúp mình nhé."
  ]);
}

function askNote() {
  return oneOf([
    "Bạn có ghi chú thêm không? (ít đường, ít đá, dị ứng...). Nếu không có thì nhắn `không` nhé.",
    "Bạn có dặn gì thêm cho quán không nè? Không có thì nhắn `không` giúp mình.",
    "Có ghi chú gì cho món không bạn? Nếu không thì nhắn `không` nhé."
  ]);
}

function askPayment() {
  return oneOf([
    "Bạn thanh toán khi nhận hàng (COD) hay chuyển khoản trước ạ? 💳",
    "Bạn chọn hình thức thanh toán giúp mình: `COD` hay `chuyển khoản` nhé.",
    "Mình chốt thanh toán nè: bạn chọn `COD` hay `chuyển khoản` ạ?"
  ]);
}

function askPaymentChoice() {
  return oneOf([
    "Bạn chọn giúp mình một trong 2 cách: `COD` hoặc `chuyển khoản` nhé.",
    "Mình nhận 2 lựa chọn thôi: `COD` hoặc `chuyển khoản` nha.",
    "Bạn nhắn `COD` hoặc `chuyển khoản` để mình chốt thanh toán nhé."
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
