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

async function main() {
  await runCase("flow COD tu den lay qua tung stage", testCodPickupFlow);
  await runCase("validate dia chi: input mo ho se bi hoi lai", testAddressValidationFlow);
  await runCase("co the huy don o bat ky buoc nao", testCancelAnyStageFlow);
  await runCase("bo sung topping cho mon vua them o ASK_ADD_MORE", testUpdateLastItemToppingFlow);
  await runCase("nho dia chi duoc noi ngay tu cau dat mon dau tien", testAddressCapturedFromFirstMessageFlow);
  await runCase("lam sach dia chi lay tu cau dat mon", testAddressCandidateIsCleanedFlow);
  await runCase("tran chau den khong bi match them tran chau trang", testToppingDenKhongBiMatchTrangFlow);
  await runCase("khong da nhung van co topping thi topping phai duoc giu lai", testKhongDaVanThemDuocToppingFlow);
  await runCase("typo chan trau trang van parse dung topping", testChanTrauTrangTypoStillParsesToppingFlow);
  await runCase("dia chi co tien to/hau to lich su duoc lam sach", testAccentedAddressPrefixSuffixCleanedFlow);

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
