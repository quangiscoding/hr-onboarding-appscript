/** ==========================================
 * LEGACY-UTILS.JS - CÁC CUSTOM FUNCTION CHO SHEET FORMULA
 * ==========================================
 * Toàn bộ hàm trong file này là @customfunction (gọi trực tiếp từ ô Google Sheet),
 * giữ nguyên tên để không phá các formula đang có trên Sheet.
 */

/**
 * Đếm số lượng một ngày cụ thể trong tuần (Monday, Tuesday...) trong một tháng.
 *
 * @param {string} dayName - Tên ngày trong tuần tiếng Anh (VD: "Monday")
 * @param {string} monthName - Tên tháng tiếng Anh (VD: "October")
 * @param {number} year - Năm cần kiểm tra (VD: 2026)
 * @return {number} Số lần xuất hiện của ngày đó trong tháng
 * @customfunction
 */
function specificDays(dayName, monthName, year) {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saterday", // giữ theo chuẩn gốc
  ];

  const day = dayNames.indexOf(dayName);
  const month = monthNames.indexOf(monthName) + 1;

  if (day === -1 || month === 0) return 0;

  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;

  for (let i = 1; i <= daysInMonth; i++) {
    if (new Date(year, month - 1, i).getDay() === day) {
      count++;
    }
  }

  return count;
}

/**
 * Loại bỏ toàn bộ dấu tiếng Việt khỏi chuỗi (Chuyển có dấu -> không dấu).
 *
 * @param {string} text - Chuỗi văn bản tiếng Việt có dấu
 * @return {string} Chuỗi đã xóa sạch dấu
 * @customfunction
 */
function removeAccent(text) {
  if (!text) return "";
  return String(text)
    .replace(/[âấầẩẫậăắằẳẵặ]/g, "a")
    .replace(/[ÂẤẦẨẪẬĂẮẰẲẴẶ]/g, "A")
    .replace(/[áàảãạ]/g, "a")
    .replace(/[ÁÀẢÃẠ]/g, "A")
    .replace(/[éèẻẽẹêếềểễệ]/g, "e")
    .replace(/[ÉÈẺẼẸÊẾỀỂỄỆ]/g, "E")
    .replace(/[óòỏõọ]/g, "o")
    .replace(/[ÓÒỎÕỌ]/g, "O")
    .replace(/[đ]/g, "d")
    .replace(/[Đ]/g, "D")
    .replace(/[ôốồổỗộơớờởỡợ]/g, "o")
    .replace(/[ÔỐỒỔỖỘƠỚỜỞỠỢ]/g, "O")
    .replace(/[úùủũụưứừửữự]/g, "u")
    .replace(/[ÚÙỦŨỤƯỨỪỬỮỰ]/g, "U")
    .replace(/[íìỉĩị]/g, "i")
    .replace(/[ÍÌỈĨỊ]/g, "I")
    .replace(/[ýỳỷỹỵ]/g, "y")
    .replace(/[ÝỲỶỸỴ]/g, "Y");
}

/**
 * Đảo cấu trúc họ tên Việt Nam: [Tên] + [Họ].
 * Ví dụ: "Trần Thị Tú Anh" -> "Anh Trần" (removeAccentFlag=1 -> "Anh Tran")
 *
 * @param {string} text - Họ và tên đầy đủ
 * @param {number} [removeAccentFlag=0] - 1: Bỏ dấu, 0: Giữ nguyên
 * @return {string}
 * @customfunction
 */
function convertVn2FirstLastName(text, removeAccentFlag = 0) {
  if (!text) return "";

  let normalized = String(text).trim();
  if (removeAccentFlag == 1) {
    normalized = removeAccent(normalized);
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];

  return `${parts[parts.length - 1]} ${parts[0]}`;
}

/**
 * Chuyển họ tên Việt Nam sang dạng quốc tế: [Tên] + [Họ + Tên lót].
 * Ví dụ: "Trần Thị Tú Anh" -> "Anh Trần Thị Tú" (removeAccentFlag=1 -> "Anh Tran Thi Tu")
 *
 * @param {string} text - Họ và tên đầy đủ
 * @param {number} [removeAccentFlag=0] - 1: Bỏ dấu, 0: Giữ nguyên
 * @return {string}
 * @customfunction
 */
function convertVn2FirstFullname(text, removeAccentFlag = 0) {
  if (!text) return "";

  let normalized = String(text).trim();
  if (removeAccentFlag == 1) {
    normalized = removeAccent(normalized);
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";

  const firstName = parts[parts.length - 1];
  return [firstName, ...parts.slice(0, -1)].join(" ");
}

/**
 * Tạo địa chỉ Email/Username từ chuỗi tên dạng FirstFullName không dấu.
 * Ví dụ: "Anh Tran Thi Tu" -> "anh.tranthitu"
 *
 * @param {string} text - Chuỗi tên dạng FirstFullName (VD: "Anh Tran Thi Tu")
 * @return {string} Tiền tố Email (VD: "anh.tranthitu")
 * @customfunction
 */
function convertFName2EmailAddress(text) {
  if (!text) return "";

  const parts = String(text).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || "";

  // [Tên chính] + "." + [Họ] + [các tên lót dính liền]
  let email = `${parts[0]}.${parts[1]}`;
  for (let i = 2; i < parts.length; i++) {
    email += parts[i];
  }

  return email;
}
