/**
 * ==========================================
 * LEGACY-UTILS.JS - BẢN FIX XONG LỖI #NAME?
 * ==========================================
 * Toàn bộ hàm trong file này là @customfunction (gọi trực tiếp từ ô Google Sheet).
 */

/**
 * Loại bỏ toàn bộ dấu tiếng Việt khỏi chuỗi (Chuyển có dấu -> không dấu).
 * @param {string|Array<Array<string>>} text - Chuỗi hoặc Range ô
 * @return {string|Array<Array<string>>}
 * @customfunction
 */
function removeAccent(text) {
  if (!text) return "";

  function clean_(str) {
    if (!str) return "";
    return String(str)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  }

  if (Array.isArray(text)) {
    return text.map(function (row) {
      return [clean_(row[0])];
    });
  }
  return clean_(text);
}

/**
 * Đếm số lượng một ngày cụ thể trong tuần trong một tháng.
 * @customfunction
 */
function specificDays(dayName, monthName, year) {
  if (!dayName || !monthName || !year) return 0;

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
    "Saterday",
  ];

  const targetDay = dayNames.indexOf(String(dayName).trim());
  const monthIdx = monthNames.indexOf(String(monthName).trim());

  if (targetDay === -1 || monthIdx === -1) return 0;

  const daysInMonth = new Date(Number(year), monthIdx + 1, 0).getDate();
  const firstDayOfWeek = new Date(Number(year), monthIdx, 1).getDay();

  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    if ((firstDayOfWeek + day - 1) % 7 === targetDay) {
      count++;
    }
  }
  return count;
}

/**
 * Đảo cấu trúc họ tên Việt Nam: [Tên] + [Họ].
 * Ví dụ: "Trần Thị Tú Anh" -> "Anh Trần"
 * @customfunction
 */
function convertVn2FirstLastName(text, removeAccentFlag) {
  const isBODau = Number(removeAccentFlag) === 1;

  function processSingle_(val) {
    if (!val) return "";
    let str = String(val).trim();
    if (!str) return "";

    if (isBODau) {
      str = str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D");
    }

    const lastSpaceIdx = str.lastIndexOf(" ");
    if (lastSpaceIdx === -1) return str;

    const firstName = str.slice(lastSpaceIdx + 1);
    const firstWord = str.slice(0, str.indexOf(" "));
    return firstName + " " + firstWord;
  }

  if (Array.isArray(text)) {
    return text.map(function (row) {
      return [processSingle_(row[0])];
    });
  }
  return processSingle_(text);
}

/**
 * Chuyển họ tên Việt Nam sang dạng quốc tế: [Tên] + [Họ + Tên lót].
 * Ví dụ: "Trần Thị Tú Anh" -> "Anh Trần Thị Tú"
 * @customfunction
 */
function convertVn2FirstFullname(text, removeAccentFlag) {
  const isBODau = Number(removeAccentFlag) === 1;

  function processSingle_(val) {
    if (!val) return "";
    let str = String(val).trim();
    if (!str) return "";

    if (isBODau) {
      str = str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D");
    }

    const lastSpaceIdx = str.lastIndexOf(" ");
    if (lastSpaceIdx === -1) return str;

    const firstName = str.slice(lastSpaceIdx + 1);
    const restName = str.slice(0, lastSpaceIdx);
    return firstName + " " + restName;
  }

  if (Array.isArray(text)) {
    return text.map(function (row) {
      return [processSingle_(row[0])];
    });
  }
  return processSingle_(text);
}

/**
 * Tạo địa chỉ Email/Username từ chuỗi tên dạng FirstFullName không dấu.
 * Ví dụ: "Anh Tran Thi Tu" -> "anh.tranthitu"
 * @customfunction
 */
function convertFName2EmailAddress(text) {
  function processSingle_(val) {
    if (!val) return "";
    const cleanStr = String(val)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .trim()
      .toLowerCase();

    const parts = cleanStr.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];

    return parts[0] + "." + parts.slice(1).join("");
  }

  if (Array.isArray(text)) {
    return text.map(function (row) {
      return [processSingle_(row[0])];
    });
  }
  return processSingle_(text);
}
