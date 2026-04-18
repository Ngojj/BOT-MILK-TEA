const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const testDbPath = path.join(__dirname, "tmp", "chatbot.test.db");
fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) {
  try {
    fs.unlinkSync(`${testDbPath}${suffix}`);
  } catch (_error) {
    // no-op
  }
}

process.env.DB_PATH = testDbPath;
process.env.GEMINI_API_KEY = "";
process.env.PAYOS_CLIENT_ID = "";
process.env.PAYOS_API_KEY = "";
process.env.PAYOS_CHECKSUM_KEY = "";

const { handleMessage, getSession, resetSession } = require("../src/services/chatbotService");
const { STAGE } = require("../src/services/chatbot/constants");
const { normalizeText } = require("../src/utils/text");
const { startItemDraft } = require("../src/services/chatbot/catalogParser");
const { collectMissingItemFields } = require("../src/services/chatbot/itemDraftFlow");

async function runCase(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

async function testCodPickupFlow() {
  const id = `t-cod-${Date.now()}`;

  let res = await handleMessage(id, "CF04 size M x1");
  assert.equal(res.stage, STAGE.COLLECTING_ITEM);

  res = await handleMessage(id, "them thach xanh");
  assert.equal(res.stage, STAGE.ASK_ADD_MORE);

  res = await handleMessage(id, "khong");
  assert.equal(res.stage, STAGE.CONFIRM_ORDER);

  res = await handleMessage(id, "dung roi");
  assert.equal(res.stage, STAGE.COLLECT_CUSTOMER_NAME);

  res = await handleMessage(id, "Nguyen Van A");
  assert.equal(res.stage, STAGE.COLLECT_CUSTOMER_PHONE);

  res = await handleMessage(id, "0912345678");
  assert.equal(res.stage, STAGE.COLLECT_CUSTOMER_ADDRESS);

  res = await handleMessage(id, "tu den lay");
  assert.equal(res.stage, STAGE.COLLECT_CUSTOMER_NOTE);

  res = await handleMessage(id, "khong");
  assert.equal(res.stage, STAGE.COLLECT_PAYMENT);

  res = await handleMessage(id, "cod");
  assert.equal(res.stage, STAGE.FINALIZED);
  assert.equal(res.order.payment_method, "COD");
  assert.ok(typeof res.reply === "string" && res.reply.length > 0);
  assert.ok(res.order.order_id.startsWith("ORD-"));

  resetSession(id);
}

async function testAddressValidationFlow() {
  const id = `t-address-${Date.now()}`;

  await handleMessage(id, "CF04 size M x1");
  await handleMessage(id, "khong topping");
  await handleMessage(id, "khong");
  await handleMessage(id, "dung roi");
  await handleMessage(id, "Nguyen Van B");
  await handleMessage(id, "0912345678");

  let res = await handleMessage(id, "ok");
  assert.equal(res.stage, STAGE.COLLECT_CUSTOMER_ADDRESS);

  res = await handleMessage(id, "98 easup daklak");
  assert.equal(res.stage, STAGE.COLLECT_CUSTOMER_NOTE);

  resetSession(id);
}

async function testConfirmOrderAcceptsDungFlow() {
  const id = `t-confirm-dung-${Date.now()}`;

  await handleMessage(id, "CF04 size M x1");
  await handleMessage(id, "khong topping");
  await handleMessage(id, "khong");
  const res = await handleMessage(id, "dung");

  assert.equal(res.stage, STAGE.COLLECT_CUSTOMER_NAME);

  resetSession(id);
}

async function testCancelAnyStageFlow() {
  const id = `t-cancel-${Date.now()}`;

  await handleMessage(id, "CF04 size M x1");
  await handleMessage(id, "khong topping");
  await handleMessage(id, "khong");
  await handleMessage(id, "dung roi");
  await handleMessage(id, "Nguyen Van C");
  await handleMessage(id, "0912345678");

  const res = await handleMessage(id, "huy don");
  assert.equal(res.stage, STAGE.GREETING);

  const session = getSession(id);
  assert.equal(session.stage, STAGE.GREETING);
  assert.equal(session.cart.length, 0);

  resetSession(id);
}

async function testUpdateLastItemToppingFlow() {
  const id = `t-top-${Date.now()}`;

  await handleMessage(id, "CF04 size M x1");
  await handleMessage(id, "khong topping");
  const res = await handleMessage(id, "them thach xanh");
  assert.equal(res.stage, STAGE.ASK_ADD_MORE);

  const session = getSession(id);
  assert.equal(session.cart.length, 1);
  assert.equal(session.cart[0].toppings.length, 1);
  assert.equal(session.cart[0].toppings[0].topping_id, "TOP04");

  resetSession(id);
}

async function testNegativeAfterAmbiguousAddMoreStillGoesConfirmFlow() {
  const id = `t-add-more-deny-${Date.now()}`;

  await handleMessage(id, "cho toi mot ca phe den them kem tuoi");
  await handleMessage(id, "L");

  // "ok" currently means user wants to continue ordering, bot asks for next item.
  let res = await handleMessage(id, "ok");
  assert.equal(res.stage, STAGE.COLLECTING_ITEM);

  // User then clarifies no more items; bot should move to confirm order.
  res = await handleMessage(id, "khong theem mon moi");
  assert.equal(res.stage, STAGE.CONFIRM_ORDER);
  assert.ok(normalizeText(res.reply).includes("tong"));

  resetSession(id);
}

async function testKhongAtToppingPromptMeansNoToppingFlow() {
  const id = `t-no-top-${Date.now()}`;

  await handleMessage(id, "cho toi mot ca phe den");
  await handleMessage(id, "L");
  const res = await handleMessage(id, "khong");

  assert.equal(res.stage, STAGE.ASK_ADD_MORE);
  const session = getSession(id);
  assert.equal(session.cart.length, 1);
  assert.equal(session.cart[0].toppings.length, 0);

  resetSession(id);
}

async function testDenyInAskAddMoreDoesNotTriggerToppingUpdateFlow() {
  const id = `t-add-more-no-update-top-${Date.now()}`;

  await handleMessage(id, "cho mot ca phe den");
  await handleMessage(id, "L");
  await handleMessage(id, "khong");

  const res = await handleMessage(id, "minh khong them");
  assert.equal(res.stage, STAGE.CONFIRM_ORDER);

  resetSession(id);
}

async function testConfirmOrderAcceptsRoiFlow() {
  const id = `t-confirm-roi-${Date.now()}`;

  await handleMessage(id, "CF01 size L x1");
  await handleMessage(id, "khong");
  await handleMessage(id, "khong");
  const res = await handleMessage(id, "roi");
  assert.equal(res.stage, STAGE.COLLECT_CUSTOMER_NAME);

  resetSession(id);
}

async function testCfDenAbbreviationStillStartsOrderFlow() {
  const id = `t-cf-den-abbr-${Date.now()}`;

  const res = await handleMessage(id, "cho mot cf den");
  assert.equal(res.stage, STAGE.COLLECTING_ITEM);
  assert.ok(normalizeText(res.reply).includes("size"));

  resetSession(id);
}

async function testCommonDrinkAbbreviationsStartOrderFlow() {
  const cases = [
    "cho mot ts khoai mon",
    "cho mot dx socola",
    "cho mot ttg chanh leo"
  ];

  for (let index = 0; index < cases.length; index += 1) {
    const id = `t-abbr-${index}-${Date.now()}`;
    const res = await handleMessage(id, cases[index]);
    assert.equal(res.stage, STAGE.COLLECTING_ITEM);
    assert.ok(normalizeText(res.reply).includes("size"));
    resetSession(id);
  }
}

async function testTopingTypoAndChanTrauShouldStillAddToppingFlow() {
  const id = `t-toping-chan-trau-${Date.now()}`;

  await handleMessage(id, "cho mot ca phe den");
  await handleMessage(id, "size l");
  const res = await handleMessage(id, "them mot chan trau");

  assert.equal(res.stage, STAGE.ASK_ADD_MORE);
  const session = getSession(id);
  assert.equal(session.cart.length, 1);
  assert.equal(session.cart[0].toppings.length, 1);
  assert.equal(session.cart[0].toppings[0].topping_id, "TOP01");

  resetSession(id);
}

async function testConfirmOrderAcceptsChuawAsDenyFlow() {
  const id = `t-confirm-chuaw-${Date.now()}`;

  await handleMessage(id, "CF01 size L x1");
  await handleMessage(id, "khong");
  await handleMessage(id, "khong");
  const res = await handleMessage(id, "chuaw");

  assert.equal(res.stage, STAGE.COLLECTING_ITEM);

  resetSession(id);
}

async function testGenericAddToppingRequestShouldAskClarifyOnlyFlow() {
  const id = `t-confirm-generic-top-${Date.now()}`;

  await handleMessage(id, "ca phe den size M x1");
  await handleMessage(id, "khong");
  let res = await handleMessage(id, "khong");
  assert.equal(res.stage, STAGE.CONFIRM_ORDER);

  res = await handleMessage(id, "toi muon them topping");
  assert.equal(res.stage, STAGE.ASK_ADD_MORE);
  assert.ok(normalizeText(res.reply).includes("topping"));

  const session = getSession(id);
  assert.equal(session.cart.length, 1);
  assert.equal(session.cart[0].toppings.length, 0);

  resetSession(id);
}

async function testAddressCapturedFromFirstMessageFlow() {
  const id = `t-addr-first-${Date.now()}`;

  await handleMessage(id, "cho mot ca phe den size L den 198 dien bien phu");
  await handleMessage(id, "khong topping");
  await handleMessage(id, "khong");
  await handleMessage(id, "ok");
  await handleMessage(id, "Hiep");

  const res = await handleMessage(id, "0986995079");
  assert.equal(res.stage, STAGE.COLLECT_CUSTOMER_NOTE);
  const replyNormalized = normalizeText(res.reply);
  assert.ok(replyNormalized.includes("dia chi"));
  assert.ok(replyNormalized.includes("198"));

  resetSession(id);
}

async function testAddressCandidateIsCleanedFlow() {
  const id = `t-addr-clean-${Date.now()}`;

  await handleMessage(id, "cho mot ca phe den size L giao den 198 dien bien phu ngay cho toi");
  await handleMessage(id, "khong topping");
  await handleMessage(id, "khong");
  await handleMessage(id, "ok");
  await handleMessage(id, "Hiep");
  const res = await handleMessage(id, "0986995079");
  const normalizedReply = normalizeText(res.reply);

  assert.equal(res.stage, STAGE.COLLECT_CUSTOMER_NOTE);
  assert.ok(normalizedReply.includes("198 dien bien phu"));
  assert.ok(!normalizedReply.includes("ngay cho toi"));

  resetSession(id);
}

async function testToppingDenKhongBiMatchTrangFlow() {
  const id = `t-top-den-${Date.now()}`;

  await handleMessage(id, "mot ca phe den them tran chau den it da giao den 198 dien bien phu ngay cho chau");
  await handleMessage(id, "L");
  await handleMessage(id, "khong");

  const session = getSession(id);
  assert.equal(session.stage, STAGE.CONFIRM_ORDER);
  assert.equal(session.cart.length, 1);
  assert.equal(session.cart[0].toppings.length, 1);
  assert.equal(session.cart[0].toppings[0].topping_id, "TOP01");

  resetSession(id);
}

async function testKhongDaVanThemDuocToppingFlow() {
  const id = `t-khong-da-${Date.now()}`;

  await handleMessage(id, "mot ca phe den size M khong da them tran chau trang giao den 198 dien bien phu ngay va luon");
  await handleMessage(id, "khong");

  const session = getSession(id);
  assert.equal(session.stage, STAGE.CONFIRM_ORDER);
  assert.equal(session.cart.length, 1);
  assert.equal(session.cart[0].toppings.length, 1);
  assert.equal(session.cart[0].toppings[0].topping_id, "TOP02");

  resetSession(id);
}

async function testChanTrauTrangTypoStillParsesToppingFlow() {
  const id = `t-chan-trau-${Date.now()}`;

  await handleMessage(id, "cho chau mot ca phe den size m khong da them chan trau trang giao den 198 dien bien phu nhe a");
  await handleMessage(id, "khong");

  const session = getSession(id);
  assert.equal(session.stage, STAGE.CONFIRM_ORDER);
  assert.equal(session.cart.length, 1);
  assert.equal(session.cart[0].toppings.length, 1);
  assert.equal(session.cart[0].toppings[0].topping_id, "TOP02");

  resetSession(id);
}

async function testAccentedAddressPrefixSuffixCleanedFlow() {
  const id = `t-addr-accent-${Date.now()}`;

  await handleMessage(id, "cho mot ca phe size m them chan trau trang giao den 198 hai ba trung nhe a");
  await handleMessage(id, "khong");
  await handleMessage(id, "ok");
  await handleMessage(id, "Hiep");
  const res = await handleMessage(id, "0986995079");
  const normalizedReply = normalizeText(res.reply);
  const firstLine = normalizedReply.split("\n")[0] || normalizedReply;

  assert.equal(res.stage, STAGE.COLLECT_CUSTOMER_NOTE);
  assert.ok(firstLine.includes("198 hai ba trung"));
  assert.ok(!firstLine.includes("den 198"));
  assert.ok(!firstLine.includes("nhe"));

  resetSession(id);
}

async function testStartItemDraftSupportsLineItemsBreakdownFlow() {
  const hint = {
    intent: "order",
    line_items: [
      { item_code: "CF02", item_name: "Cà Phê Sữa", size: "L", quantity: 2 },
      { item_code: "CF02", item_name: "Cà Phê Sữa", size: "M", quantity: 1 }
    ]
  };
  const draft = startItemDraft("cho 3 ca phe sua", hint);

  assert.ok(draft);
  assert.equal(draft.item_id, "CF02");
  assert.equal(draft.quantity, 3);
  assert.ok(Array.isArray(draft.size_breakdown));
  assert.equal(draft.size_breakdown.length, 2);
  assert.equal(draft.size_breakdown[0].size, "L");
  assert.equal(draft.size_breakdown[0].quantity, 2);
  assert.equal(draft.size_breakdown[1].size, "M");
  assert.equal(draft.size_breakdown[1].quantity, 1);
}

async function testCollectMissingFieldsUsesLineItemsByItemNameFlow() {
  const session = {
    stage: STAGE.COLLECTING_ITEM,
    cart: [],
    currentItem: {
      item_id: "CF01",
      name: "Cà Phê Đen",
      size: null,
      quantity: null,
      unit_price: null,
      toppings: null,
      subtotal: 0
    }
  };

  const hint = {
    intent: "deny",
    line_items: [
      { item_name: "Cà Phê Đen", size: "L", quantity: 1 },
      { item_name: "Trà Sữa Trân Châu Đen", size: "M", quantity: 1 }
    ]
  };

  const reply = collectMissingItemFields(session, "khong", hint);
  assert.equal(session.stage, STAGE.ASK_ADD_MORE);
  assert.equal(session.cart.length, 2);
  assert.equal(session.cart[0].item_id, "CF01");
  assert.equal(session.cart[0].size, "L");
  assert.equal(session.cart[1].item_id, "TS01");
  assert.equal(session.cart[1].size, "M");
  assert.ok(normalizeText(reply).includes("ca phe den"));
  assert.ok(normalizeText(reply).includes("tra sua tran chau den"));
}

async function testLineItemsWithChanTrauTypoStillMapsDrinkFlow() {
  const session = {
    stage: STAGE.COLLECTING_ITEM,
    cart: [],
    currentItem: {
      item_id: "CF01",
      name: "Cà Phê Đen",
      size: null,
      quantity: null,
      unit_price: null,
      toppings: null,
      subtotal: 0
    }
  };

  const hint = {
    intent: "deny",
    line_items: [
      { item_name: "Cà Phê Đen", size: "L", quantity: 1 },
      { item_name: "Trà sữa chân trâu", size: "M", quantity: 1 }
    ]
  };

  collectMissingItemFields(session, "khong", hint);
  assert.equal(session.stage, STAGE.ASK_ADD_MORE);
  assert.equal(session.cart.length, 2);
  assert.equal(session.cart[0].item_id, "CF01");
  assert.equal(session.cart[1].item_id, "TS01");
}

async function testStartItemDraftKeepsMultiItemsForDifferentDrinksFlow() {
  const hint = {
    intent: "order",
    line_items: [
      { item_code: "TS01", item_name: "Trà Sữa Trân Châu Đen", size: "L", quantity: 1 },
      { item_code: "CF01", item_name: "Cà Phê Đen", size: "M", quantity: 1 }
    ]
  };

  const draft = startItemDraft("cho mot ts size l va mot cf den size m", hint);
  assert.ok(draft);
  assert.ok(Array.isArray(draft.multi_items));
  assert.equal(draft.multi_items.length, 2);
  assert.equal(draft.multi_items[0].item_id, "TS01");
  assert.equal(draft.multi_items[0].size, "L");
  assert.equal(draft.multi_items[1].item_id, "CF01");
  assert.equal(draft.multi_items[1].size, "M");
}

async function testStartItemDraftDefaultsMissingLineItemQuantityToOneFlow() {
  const hint = {
    intent: "order",
    line_items: [
      { item_code: "CF01", item_name: "Cà Phê Đen", size: "M", quantity: 1 },
      { item_code: "CF02", item_name: "Cà Phê Sữa", size: "L", quantity: null }
    ]
  };

  const draft = startItemDraft("lay cho toi mot ca phe den size m va mot ca phe sua size l", hint);
  assert.ok(draft);
  assert.ok(Array.isArray(draft.multi_items));
  assert.equal(draft.multi_items.length, 2);
  assert.equal(draft.multi_items[0].item_id, "CF01");
  assert.equal(draft.multi_items[0].quantity, 1);
  assert.equal(draft.multi_items[1].item_id, "CF02");
  assert.equal(draft.multi_items[1].quantity, 1);
}

async function testCollectMissingFieldsFinalizesExistingMultiItemsFlow() {
  const session = {
    stage: STAGE.COLLECTING_ITEM,
    cart: [],
    currentItem: {
      item_id: "TS01",
      name: "Trà Sữa Trân Châu Đen",
      size: "L",
      quantity: 2,
      unit_price: 45000,
      multi_items: [
        { item_id: "TS01", name: "Trà Sữa Trân Châu Đen", size: "L", quantity: 1, unit_price: 45000 },
        { item_id: "CF01", name: "Cà Phê Đen", size: "M", quantity: 1, unit_price: 25000 }
      ],
      toppings: null,
      subtotal: 0
    }
  };

  collectMissingItemFields(session, "khong", { intent: "deny", line_items: [] });
  assert.equal(session.stage, STAGE.ASK_ADD_MORE);
  assert.equal(session.cart.length, 2);
  assert.equal(session.cart[0].item_id, "TS01");
  assert.equal(session.cart[0].size, "L");
  assert.equal(session.cart[1].item_id, "CF01");
  assert.equal(session.cart[1].size, "M");
}

async function testKhoongAtToppingPromptMeansNoToppingFlow() {
  const id = `t-no-top-khoong-${Date.now()}`;

  await handleMessage(id, "cho mot ca phe den size L");
  const res = await handleMessage(id, "khoong");

  assert.equal(res.stage, STAGE.ASK_ADD_MORE);
  const session = getSession(id);
  assert.equal(session.cart.length, 1);
  assert.equal(session.cart[0].toppings.length, 0);

  resetSession(id);
}

async function testMultiItemsInferSizeByEachItemMentionFlow() {
  const session = {
    stage: STAGE.COLLECTING_ITEM,
    cart: [],
    currentItem: {
      item_id: "TS01",
      name: "Trà Sữa Trân Châu Đen",
      size: "L",
      quantity: null,
      unit_price: null,
      toppings: null,
      subtotal: 0
    }
  };

  const hint = {
    intent: "deny",
    line_items: [
      { item_code: "TS01", item_name: "Trà Sữa Trân Châu Đen", size: "L", quantity: 1 },
      { item_code: "CF01", item_name: "Cà Phê Đen", size: null, quantity: 1 }
    ]
  };

  collectMissingItemFields(session, "cho mot tra sua tran chau size L va mot ca phe den size M", hint);
  assert.equal(session.stage, STAGE.ASK_ADD_MORE);
  assert.equal(session.cart.length, 2);
  assert.equal(session.cart[0].item_id, "TS01");
  assert.equal(session.cart[0].size, "L");
  assert.equal(session.cart[1].item_id, "CF01");
  assert.equal(session.cart[1].size, "M");
}

async function testSingleMessageTwoDrinksDoNotDropSecondItemFlow() {
  const id = `t-two-drinks-one-msg-${Date.now()}`;

  let res = await handleMessage(id, "lay cho toi 1 ca phe den size M va 1 ca phe sua size L");
  assert.equal(res.stage, STAGE.ASK_ADD_MORE);
  const sessionAfterAdd = getSession(id);
  assert.equal(sessionAfterAdd.cart.length, 2);
  assert.equal(sessionAfterAdd.cart[0].item_id, "CF01");
  assert.equal(sessionAfterAdd.cart[0].size, "M");
  assert.equal(sessionAfterAdd.cart[1].item_id, "CF02");
  assert.equal(sessionAfterAdd.cart[1].size, "L");

  res = await handleMessage(id, "khoong");
  assert.equal(res.stage, STAGE.CONFIRM_ORDER);
  const summary = normalizeText(res.reply);
  assert.ok(summary.includes("ca phe den"));
  assert.ok(summary.includes("ca phe sua"));

  resetSession(id);
}

async function testConfirmOrderAllowsToppingEditRequestFlow() {
  const id = `t-confirm-edit-topping-${Date.now()}`;

  await handleMessage(id, "CF04 size M x1");
  await handleMessage(id, "khong topping");
  let res = await handleMessage(id, "khong");
  assert.equal(res.stage, STAGE.CONFIRM_ORDER);

  res = await handleMessage(id, "toi muon them toping");
  assert.equal(res.stage, STAGE.ASK_ADD_MORE);
  assert.ok(normalizeText(res.reply).includes("topping"));

  resetSession(id);
}

async function main() {
  await runCase("flow COD tu den lay qua tung stage", testCodPickupFlow);
  await runCase("validate dia chi: input mo ho se bi hoi lai", testAddressValidationFlow);
  await runCase("xac nhan don bang tu dung se qua buoc nhap ten", testConfirmOrderAcceptsDungFlow);
  await runCase("co the huy don o bat ky buoc nao", testCancelAnyStageFlow);
  await runCase("bo sung topping cho mon vua them o ASK_ADD_MORE", testUpdateLastItemToppingFlow);
  await runCase(
    "dang o collecting item nhung nguoi dung noi khong them nua thi chuyen sang confirm",
    testNegativeAfterAmbiguousAddMoreStillGoesConfirmFlow
  );
  await runCase("tra loi khong o buoc topping duoc xem la khong topping", testKhongAtToppingPromptMeansNoToppingFlow);
  await runCase("khong them o ASK_ADD_MORE phai sang confirm, khong sua topping", testDenyInAskAddMoreDoesNotTriggerToppingUpdateFlow);
  await runCase("xac nhan don bang tu roi se qua buoc nhap ten", testConfirmOrderAcceptsRoiFlow);
  await runCase("viet tat cf den van vao duoc flow dat mon", testCfDenAbbreviationStillStartsOrderFlow);
  await runCase("nhan dien viet tat cac nhom mon pho bien", testCommonDrinkAbbreviationsStartOrderFlow);
  await runCase("toping typo + chan trau van parse duoc topping mac dinh", testTopingTypoAndChanTrauShouldStillAddToppingFlow);
  await runCase("chuaw o buoc xac nhan duoc hieu la chua dung", testConfirmOrderAcceptsChuawAsDenyFlow);
  await runCase("yeu cau them topping chung chung thi chi hoi lai, khong auto update", testGenericAddToppingRequestShouldAskClarifyOnlyFlow);
  await runCase("nho dia chi duoc noi ngay tu cau dat mon dau tien", testAddressCapturedFromFirstMessageFlow);
  await runCase("lam sach dia chi lay tu cau dat mon", testAddressCandidateIsCleanedFlow);
  await runCase("tran chau den khong bi match them tran chau trang", testToppingDenKhongBiMatchTrangFlow);
  await runCase("khong da nhung van co topping thi topping phai duoc giu lai", testKhongDaVanThemDuocToppingFlow);
  await runCase("typo chan trau trang van parse dung topping", testChanTrauTrangTypoStillParsesToppingFlow);
  await runCase("dia chi co tien to/hau to lich su duoc lam sach", testAccentedAddressPrefixSuffixCleanedFlow);
  await runCase("startItemDraft hieu line_items nhieu size", testStartItemDraftSupportsLineItemsBreakdownFlow);
  await runCase("collectMissingItemFields dung line_items theo item_name", testCollectMissingFieldsUsesLineItemsByItemNameFlow);
  await runCase("line_items voi typo chan trau van map dung mon", testLineItemsWithChanTrauTypoStillMapsDrinkFlow);
  await runCase("startItemDraft giu du multi_items cho nhieu mon", testStartItemDraftKeepsMultiItemsForDifferentDrinksFlow);
  await runCase("line_items thieu quantity van mac dinh 1 cho moi mon", testStartItemDraftDefaultsMissingLineItemQuantityToOneFlow);
  await runCase("collectMissingItemFields chot du multi_items san co", testCollectMissingFieldsFinalizesExistingMultiItemsFlow);
  await runCase("tra loi khoong o buoc topping duoc xem la khong topping", testKhoongAtToppingPromptMeansNoToppingFlow);
  await runCase("nhieu mon phai suy size theo tung mon, khong lay nham size dau", testMultiItemsInferSizeByEachItemMentionFlow);
  await runCase("dat 2 mon trong 1 cau khong bi roi mon thu 2", testSingleMessageTwoDrinksDoNotDropSecondItemFlow);
  await runCase("o buoc xac nhan van yeu cau sua topping duoc", testConfirmOrderAllowsToppingEditRequestFlow);

  if (process.exitCode) {
    console.error("One or more tests failed.");
  } else {
    console.log("All tests passed.");
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
