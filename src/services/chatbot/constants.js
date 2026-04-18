const APP_BASE_URL = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

/** URL công khai để Telegram tải ảnh menu (bắt buộc khi deploy Linux/Render). */
function getMenuPhotoUrl() {
  const explicit = process.env.MENU_IMAGE_URL?.trim();
  if (explicit) return explicit;
  return `${APP_BASE_URL}/static/menu.png`;
}

/** Tuỳ chọn: đường dẫn file local (chủ yếu dev Windows). */
const MENU_IMAGE_PATH = process.env.MENU_IMAGE_PATH?.trim() || null;

const STAGE = {
  GREETING: "GREETING",
  COLLECTING_ITEM: "COLLECTING_ITEM",
  ASK_ADD_MORE: "ASK_ADD_MORE",
  CONFIRM_ORDER: "CONFIRM_ORDER",
  COLLECT_CUSTOMER_NAME: "COLLECT_CUSTOMER_NAME",
  COLLECT_CUSTOMER_PHONE: "COLLECT_CUSTOMER_PHONE",
  COLLECT_CUSTOMER_ADDRESS: "COLLECT_CUSTOMER_ADDRESS",
  COLLECT_CUSTOMER_NOTE: "COLLECT_CUSTOMER_NOTE",
  COLLECT_PAYMENT: "COLLECT_PAYMENT",
  FINALIZED: "FINALIZED"
};

module.exports = {
  APP_BASE_URL,
  getMenuPhotoUrl,
  MENU_IMAGE_PATH,
  STAGE
};

