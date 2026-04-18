const { formatVnd } = require("../../utils/text");

function oneOf(options) {
  return options[Math.floor(Math.random() * options.length)];
}

function askSize() {
  return oneOf([
    "Sốp lên món ngay nè, khách chốt size M hoặc L giúp Castea nha 🧋",
    "Món này khách chọn size M hay L để sốp làm liền nha.",
    "Cho sốp xin size (M/L), sốp thêm vào đơn ngay cho khách."
  ]);
}

function askQuantity() {
  return oneOf([
    "Khách lấy mấy ly nè? 👌",
    "Số lượng khách muốn là bao nhiêu ạ?",
    "Cho sốp xin số lượng nha khách ui."
  ]);
}

function askToppingMissing() {
  return oneOf([
    "Khách muốn thêm topping gì cho món này hong ạ?",
    "Khách dặn topping giúp sốp nhé, sốp cập nhật ngay cho khách nà.",
    "Món này khách muốn thêm topping gì nữa nè?"
  ]);
}

function itemAdded(last) {
  return oneOf([
    `Sốp đã thêm ${last.name} size ${last.size} x${last.quantity} ✅ Khách cần gọi thêm thì nhắn món tiếp theo, hoặc nhắn \`không\` để sốp chốt đơn nhe.`,
    `${last.name} size ${last.size} x${last.quantity} đã vào giỏ rồi nè. Khách nhắn món tiếp theo bất cứ lúc nào, hoặc nhắn \`không\` để chốt đơn.`,
    `Okiela, ${last.name} size ${last.size} x${last.quantity} đã được thêm. Khách cần gọi thêm thì nhắn tiếp giúp sốp, hoặc nhắn \`không\` để chốt đơn.`
  ]);
}

function askToppingClarify() {
  return oneOf([
    "Sốp chưa rõ topping khách muốn thêm, khách nhắn lại giúp Castea nhe.",
    "Khách iu nói rõ giúp sốp topping cần thêm để sốp cập nhật chuẩn hơn nha.",
    "Castea chưa bắt được tên topping, khách nhắn lại giúp sốp một lần nữa nhe."
  ]);
}

function toppingUpdated(lastItem) {
  return oneOf([
    `Okiela, sốp đã cập nhật topping cho ${lastItem.name} size ${lastItem.size} x${lastItem.quantity}. Khách cần gọi thêm thì nhắn tiếp, hoặc nhắn \`không\` để chốt đơn.`,
    `Sốp thêm topping cho ${lastItem.name} xong rồi nha. Khách nhắn món tiếp theo khi cần, hoặc nhắn \`không\` để chốt đơn.`,
    `Đã chỉnh topping cho ${lastItem.name} rồi ✅ Khách cần gọi thêm thì nhắn tiếp giúp Castea, hoặc nhắn \`không\` để chốt đơn.`
  ]);
}

function greetingOpen() {
  return oneOf([
    "Rất vui được phục vụ khách hôm nay 🌟 Khách muốn xem menu hay gọi món luôn nè?",
    "Chào mừng khách đến với Castea 💛 Sốp sẵn sàng nhận đơn ngay, khách muốn xem menu hay gọi món luôn?",
    "Hello khách iu ✨ Cảm ơn khách đã ghé Castea. Khách muốn xem menu trước hay đặt món luôn cho sốp nhe?"
  ]);
}

function askItemName() {
  return oneOf([
    "Khách gọi món nào thì nhắn tên món giúp sốp nha.",
    "Cho Castea biết món khách muốn gọi để sốp lên đơn nhé.",
    "Khách muốn dùng món gì, nhắn sốp để sốp thêm vào đơn liền nè."
  ]);
}

function askAddMore() {
  return oneOf([
    "Khách có thể nhắn món tiếp theo bất cứ lúc nào, hoặc nhắn `không` để Castea chốt đơn.",
    "Cần gọi thêm thì nhắn món tiếp theo giúp sốp, hoặc nhắn `không` để chốt đơn.",
    "Khách nhắn tiếp món nếu cần, còn hong thì nhắn `không` để sốp chốt đơn liền nha."
  ]);
}

function askConfirmOrder() {
  return oneOf([
    "Khách xem giúp sốp, nếu ổn thì nhắn `đúng`, cần sửa thì nhắn `chưa đúng` nha.",
    "Sốp gửi khách bản chốt đơn rồi nè: okiela thì nhắn `đúng`, muốn chỉnh thì nhắn `chưa đúng`.",
    "Castea chờ khách xác nhận đơn: nhắn `đúng` để tiếp tục, hoặc `chưa đúng` để sốp sửa liền."
  ]);
}

function askName() {
  return oneOf([
    "Sốp xin tên người nhận để chốt đơn cho chuẩn nhé khách iu 😊",
    "Khách gửi sốp tên người nhận nha.",
    "Cho Castea tên người nhận, sốp đi tiếp bước xác nhận liền nè."
  ]);
}

function askPhone() {
  return oneOf([
    "Khách gửi sốp số điện thoại nhận hàng nhe 📱",
    "Cho Castea xin SĐT khách để shipper liên hệ lẹ nha.",
    "Sốp cần số điện thoại nhận hàng, khách nhắn giúp sốp là chốt xong bước này gòi."
  ]);
}

function invalidPhone() {
  return oneOf([
    "SĐT này chưa hợp lệ rùi, khách kiểm tra lại giúp sốp nhe.",
    "Sốp thấy SĐT hơi sai sai, khách iu gửi lại giúp Castea nha.",
    "SĐT chưa chuẩn gòi, khách nhập lại giúp sốp nhé."
  ]);
}

function askAddress() {
  return oneOf([
    "Khách muốn giao tận nơi hay tự đến lấy để Castea chuẩn bị cho chuẩn ạ?",
    "Sốp có cả giao tận nơi và tự lấy, khách chốt cách nhận hàng nhe.",
    "Khách chọn giúp sốp nha: giao tận nơi hay ghé Castea lấy lun."
  ]);
}

function askAddressRetry() {
  return oneOf([
    "Khách gửi sốp địa chỉ chi tiết (số nhà + tên đường) để sốp giao trúng phóc nhe.",
    "Cho Castea xin địa chỉ cụ thể xíu xiu để shipper dễ tìm khách nha.",
    "Khách nhắn giúp sốp địa chỉ đầy đủ hơn để sốp lên đơn giao lẹ nhe."
  ]);
}

function askDeliveryAddress() {
  return oneOf([
    "Okiela khách, cho sốp xin địa chỉ giao hàng cụ thể (số nhà + tên đường) nhe.",
    "Castea nhận giao tận nơi lun, khách gửi địa chỉ chi tiết giúp sốp để chốt bill.",
    "Khách nhắn địa chỉ đầy đủ để sốp lên đơn giao cho lẹ nha."
  ]);
}

function askNote() {
  return oneOf([
    "Khách có dặn thêm gì hông (như ít đường, ít đá...).",
    "Khách có lưu ý gì cho Castea cứ nhắn nha, sốp ghi chú lại hết nà.",
    "Nếu hong có ghi chú thêm, khách cứ nhắn `không` là xong gòi."
  ]);
}

function askPayment() {
  return oneOf([
    "Khách muốn COD nhận hàng hay chuyển khoản trước ạ? 💳",
    "Sốp qua bước thanh toán nè, khách chọn hình thức giúp sốp nhe.",
    "Tới bước thanh toán gòi, khách chọn cách nào tiện nhất cho khách nha."
  ]);
}

function askPaymentChoice() {
  return oneOf([
    "Sốp chưa rõ hình thức thanh toán, khách nhắn lại giúp Castea nhé.",
    "Khách cho sốp biết muốn COD hay chuyển khoản nè.",
    "Castea cần xác nhận lại cách thanh toán để chốt đơn cho khách nha."
  ]);
}

function resetDone() {
  return oneOf([
    "Sốp đã reset phiên gòi nha. Khách muốn xem menu hay đặt món luôn ạ? 😊",
    "Xong gòi nè, Castea đã làm mới đơn. Khách muốn xem menu hay gọi món nà?",
    "Sốp reset xong rùi. Giờ khách muốn nghía menu hay đặt món liền nè?"
  ]);
}

function readyNewOrder() {
  return oneOf([
    "Sốp sẵn sàng nhận đơn mới nà. Khách muốn xem menu hay chốt món luôn? 😊",
    "Okiela, sốp quay lại đơn mới gòi. Khách xem menu hay gọi luôn nà?",
    "Castea sẵn sàng gòi nha. Khách xem menu hay gọi món lun nè?"
  ]);
}

function cancelDone() {
  return oneOf([
    "Sốp đã hủy đơn hiện tại cho khách gòi. Khi nào lên đơn lại, khách cứ nhắn `menu` nha.",
    "Đã hủy đơn rùi nà. Lúc nào khách iu đặt lại thì nhắn `menu` giúp Castea nhe.",
    "Sốp hủy đơn giúp khách gòi. Khách muốn đặt lại thì ới sốp bất cứ lúc nào nha."
  ]);
}

function unknown() {
  return oneOf([
    "Sốp chưa bắt sóng được ý khách, khách nhắn lại giúp sốp nhe.",
    "Castea chưa hiểu lắm, khách iu nói lại ngắn gọn xíu nha.",
    "Khách nói lại câu này theo cách khác xíu xiu được hông, để sốp hiểu lẹ hơn nà."
  ]);
}

function paymentCreatedPayOS(order) {
  return oneOf([
    `Sốp tạo xong link PayOS cho đơn ${order.order_id} gòi nè ✅`,
    `Okiela khách iu, link PayOS cho đơn ${order.order_id} sẵn sàng nà ✅`,
    `Castea đã tạo thanh toán PayOS đơn ${order.order_id}, khách quét mã là ting ting ngay ✅`
  ]);
}

function payosCreateFailed(orderId) {
  return oneOf([
    `Sốp đã nhận đơn ${orderId}, nhưng xui cái là chưa tạo được QR PayOS á.`,
    `Đơn ${orderId} Castea nhận gòi, nhưng chưa nhả ra được mã PayOS.`,
    `Sốp chốt đơn ${orderId} rùi, cơ mà hệ thống đang bị lag QR xíu xiu.`
  ]);
}

function paymentReceivedThankYou(order) {
  const totalFormatted = formatVnd(order.total);
  const orderId = order.order_id;
  return oneOf([
    `Cảm ơn khách iu đã thanh toán đơn ${orderId} (${totalFormatted}). Castea luôn chào đón khách nghen. Mãi iu! 💖`,
    `Sốp đã nhận ting ting đơn ${orderId} (${totalFormatted}) gòi nà. Cảm ơn khách iu nha! ❤️`,
    `Đã xác nhận thanh toán đơn ${orderId} (${totalFormatted}) rùi nha. Yêu khách nhiều nhìu! 🥰`
  ]);
}

function orderConfirmed({ orderId, totalFormatted, paymentMethod, isPickup }) {
  const deliveryLine = isPickup ? "Khách ghé Castea lấy khi nào tiện nhe." : "Sốp sẽ ưu tiên chuẩn bị lẹ làng và giao tới tay khách nè.";
  if (paymentMethod === "COD") {
    return oneOf([
      `Sốp chốt đơn thành công rùi nha ✅\nMã đơn: ${orderId}\nTổng tiền: ${totalFormatted}\nThanh toán: COD\n${deliveryLine}`,
      `Đơn của khách đã được Castea chốt ✅\nMã đơn: ${orderId}\nTổng: ${totalFormatted}\nHình thức: COD\n${deliveryLine}`,
      `Okiela, sốp chốt đơn gòi ✅\nMã đơn: ${orderId}\nTổng tiền: ${totalFormatted}\nThanh toán khi nhận (COD)\n${deliveryLine}`
    ]);
  }

  return oneOf([
    `Sốp chốt đơn thành công rùi nha ✅\nMã đơn: ${orderId}\nTổng tiền: ${totalFormatted}\nThanh toán: chuyển khoản\n${deliveryLine}`,
    `Đơn của khách đã được Castea chốt ✅\nMã đơn: ${orderId}\nTổng: ${totalFormatted}\nHình thức: chuyển khoản\n${deliveryLine}`,
    `Okiela, sốp chốt đơn gòi ✅\nMã đơn: ${orderId}\nTổng tiền: ${totalFormatted}\nThanh toán: chuyển khoản\n${deliveryLine}`
  ]);
}

function askMessageContent() {
  return "Khách nhắn sốp nội dung cần hỗ trợ nhe 😊";
}

function menuPhotoCaptionText() {
  return "📋 ĐÂY LÀ MENU CỦA SỐP NÈ\n\nKhách muốn order luôn hay cần sốp tư vấn thêm món hong ạ? 🧋";
}

function consultMenu() {
  return oneOf([
    "Sốp gợi ý khách thử Trà Sữa Trân Châu Đen (best-seller) mlem mlem lắm, hoặc Trà Trái Cây giải nhiệt nha! Khách ưng món nào hông nè? 🧋",
    "Nếu khách phân vân thì quất luôn Trà Sữa Trân Châu Đen nha, món tủ của Castea đó! Hoặc Cà Phê Sữa nếu khách cần nạp năng lượng. Khách chốt món nào nà? 🥰",
    "Khách thử Trà Sữa Trân Châu Đen hoặc Trà Trái Cây nha, chua chua ngọt ngọt cuốn lắm lun. Khách muốn thử món nào ạ? ✨"
  ]);
}

function askNextItemOrConfirm() {
  return "Sốp sẵn sàng lên món tiếp nà. Khách nhắn món cần gọi, hoặc nhắn `không` để sốp chốt đơn lun.";
}

function askEditOrderDirection() {
  return "Khách muốn chỉnh đơn sao nè? Khách có thể nhắn món thêm/sửa, hoặc `reset` để sốp làm đơn mới toanh nha.";
}

function acknowledgePreviousAddress(address, askNoteStr) {
  return `Sốp nhớ địa chỉ khách nãy đưa rùi nè: ${address}.\n${askNoteStr}`;
}

function retrievePreviousAddress(address, askNoteStr) {
  return `Castea bưng lại địa chỉ nãy khách gửi nha: ${address}.\n${askNoteStr}`;
}

function manualTransferNotice() {
  return "\nHiện sốp chưa cài xong PayOS, sốp sẽ gửi thông tin chuyển khoản thủ công nha.";
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
  askDeliveryAddress,
  askNote,
  askPayment,
  askPaymentChoice,
  resetDone,
  readyNewOrder,
  cancelDone,
  unknown,
  paymentCreatedPayOS,
  payosCreateFailed,
  paymentReceivedThankYou,
  orderConfirmed,
  askMessageContent,
  menuPhotoCaptionText,
  consultMenu,
  askNextItemOrConfirm,
  askEditOrderDirection,
  acknowledgePreviousAddress,
  retrievePreviousAddress,
  manualTransferNotice
};
