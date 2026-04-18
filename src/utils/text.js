function normalizeText(input) {
  return (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase()
    .trim();
}

function formatVnd(value) {
  return `${Number(value).toLocaleString("vi-VN")}đ`;
}

function extractQuantity(text) {
  const normalized = normalizeText(text);
  const byX = normalized.match(/\bx\s*(\d+)\b/);
  if (byX) return Number(byX[1]);

  const byUnit = normalized.match(/\b(\d+)\s*(ly|coc|phan|suat)\b/);
  if (byUnit) return Number(byUnit[1]);

  // Bare numbers are ambiguous (can be house numbers/phone/address).
  // Only accept a standalone number when it is small and the sentence
  // does not look like delivery/address context.
  const hasAddressContext =
    /\b(giao|dia chi|so nha|duong|hem|ngo|ngach|phuong|quan|huyen|tp|tinh|o)\b/.test(normalized);
  const number = normalized.match(/\b(\d+)\b/);
  if (number) {
    const value = Number(number[1]);
    if (!hasAddressContext && value >= 1 && value <= 20) {
      return value;
    }
  }

  const wordMap = {
    mot: 1,
    hai: 2,
    ba: 3,
    bon: 4,
    tu: 4,
    nam: 5,
    sau: 6,
    bay: 7,
    tam: 8,
    chin: 9,
    muoi: 10
  };
  for (const [word, value] of Object.entries(wordMap)) {
    if (new RegExp(`\\b${word}\\b`).test(normalized)) return value;
  }
  return null;
}

function extractSize(text) {
  const normalized = normalizeText(text);
  const fromSizeWord = normalized.match(/\bsize\s*([ml])\b/);
  if (fromSizeWord) return fromSizeWord[1].toUpperCase();
  const fromSingle = normalized.match(/\b([ml])\b/);
  if (fromSingle) return fromSingle[1].toUpperCase();
  return null;
}

function isAffirmative(text) {
  const normalized = normalizeText(text);
  return /\b(co|ok|oke|okela|dong y|duoc|yes|dung roi|dung|roi|roii|chuan|xac nhan)\b/.test(normalized);
}

function isNegative(text) {
  const normalized = normalizeText(text);
  return /\b(khong them|khong dung|chua dung|chua|chuaw|khong+|kho+ng+|ko|kh|no|thoi)\b|^k$/.test(normalized);
}

module.exports = {
  normalizeText,
  formatVnd,
  extractQuantity,
  extractSize,
  isAffirmative,
  isNegative
};
