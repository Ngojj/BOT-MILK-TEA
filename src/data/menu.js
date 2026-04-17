const MENU_ITEMS = [
  { id: "TS01", category: "Trà Sữa", name: "Trà Sữa Trân Châu Đen", description: "Trà sữa thơm béo với trân châu đen dai ngon", prices: { M: 35000, L: 45000 } },
  { id: "TS02", category: "Trà Sữa", name: "Trà Sữa Trân Châu Trắng", description: "Trà sữa mịn với trân châu trắng", prices: { M: 35000, L: 45000 } },
  { id: "TS03", category: "Trà Sữa", name: "Trà Sữa Truyền Thống", description: "Trà sữa nguyên chất không topping", prices: { M: 30000, L: 40000 } },
  { id: "TS04", category: "Trà Sữa", name: "Trà Sữa Khoai Môn", description: "Trà sữa vị khoai môn hấp dẫn", prices: { M: 38000, L: 48000 } },
  { id: "TS05", category: "Trà Sữa", name: "Trà Sữa Bạc Hà", description: "Trà sữa bạc hà tươi mát", prices: { M: 35000, L: 45000 } },
  { id: "TTG01", category: "Trà Trái Cây", name: "Trà Dâu Tây", description: "Trà tươi vị dâu tây ngọt ngào", prices: { M: 32000, L: 42000 } },
  { id: "TTG02", category: "Trà Trái Cây", name: "Trà Mâm Xôi", description: "Trà mâm xôi tươi mát", prices: { M: 32000, L: 42000 } },
  { id: "TTG03", category: "Trà Trái Cây", name: "Trà Chanh Leo", description: "Trà chanh leo chua nhẹ", prices: { M: 30000, L: 40000 } },
  { id: "TTG04", category: "Trà Trái Cây", name: "Trà Vải Thiều", description: "Trà vải thiều ngọt hương", prices: { M: 33000, L: 43000 } },
  { id: "TTG05", category: "Trà Trái Cây", name: "Trà Xoài", description: "Trà xoài tươi vị nhiệt đới", prices: { M: 32000, L: 42000 } },
  { id: "CF01", category: "Cà Phê", name: "Cà Phê Đen", description: "Cà phê đen đậm đà", prices: { M: 25000, L: 30000 } },
  { id: "CF02", category: "Cà Phê", name: "Cà Phê Sữa", description: "Cà phê sữa béo", prices: { M: 28000, L: 33000 } },
  { id: "CF03", category: "Cà Phê", name: "Cà Phê Caramel", description: "Cà phê với caramel mượt", prices: { M: 30000, L: 35000 } },
  { id: "CF04", category: "Cà Phê", name: "Cà Phê Mocha", description: "Cà phê với chocolate ngọt dịu", prices: { M: 32000, L: 37000 } },
  { id: "CF05", category: "Cà Phê", name: "Cà Phê Macchiato", description: "Cà phê espresso với sữa", prices: { M: 27000, L: 32000 } },
  { id: "DX01", category: "Đá Xay", name: "Đá Xay Dâu Tây", description: "Đá xay mịn vị dâu tây tươi mát", prices: { M: 35000, L: 45000 } },
  { id: "DX02", category: "Đá Xay", name: "Đá Xay Dừa", description: "Đá xay vị dừa ngọt", prices: { M: 35000, L: 45000 } },
  { id: "DX03", category: "Đá Xay", name: "Đá Xay Matcha", description: "Đá xay matcha tươi", prices: { M: 38000, L: 48000 } },
  { id: "DX04", category: "Đá Xay", name: "Đá Xay Socola", description: "Đá xay socola ngọt thơm", prices: { M: 36000, L: 46000 } }
];

const TOPPINGS = [
  { id: "TOP01", name: "Trân Châu Đen", price: 5000 },
  { id: "TOP02", name: "Trân Châu Trắng", price: 5000 },
  { id: "TOP03", name: "Thạch Cà Chua", price: 4000 },
  { id: "TOP04", name: "Thạch Xanh", price: 4000 },
  { id: "TOP05", name: "Nước Cốt Dừa", price: 6000 },
  { id: "TOP06", name: "Kem Tươi", price: 8000 },
  { id: "TOP07", name: "Gelée Khoai Môn", price: 5000 },
  { id: "TOP08", name: "Bột Trà Xanh", price: 3000 }
];

module.exports = {
  MENU_ITEMS,
  TOPPINGS
};
