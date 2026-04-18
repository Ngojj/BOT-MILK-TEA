require("dotenv").config();
const { analyzeCustomerMessage } = require("../src/services/geminiNluService");

async function test() {
  const result = await analyzeCustomerMessage("cho mình một trà sữa trân châu size M và một cà phê đen size L thêm kem tươi", { stage: "GREETING" });
  console.log(JSON.stringify(result, null, 2));
}

test();
