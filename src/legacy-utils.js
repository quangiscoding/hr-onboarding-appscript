/**
 * Đếm số lượng của một ngày cụ thể trong tuần (như Monday, Tuesday...) có trong một tháng.
 *
 * @param {string} dayName - Tên ngày trong tuần bằng tiếng Anh (VD: "Monday", "Tuesday")
 * @param {string} monthName - Tên tháng bằng tiếng Anh (VD: "January", "October")
 * @param {number} year - Năm cần kiểm tra (VD: 2026)
 * @return {number} Số lần xuất hiện của ngày đó trong tháng
 */
function specificDays(dayName, monthName, year) {
  // Danh sách tên 12 tháng bằng tiếng Anh
  var monthNames = [
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

  // Danh sách tên các ngày trong tuần bằng tiếng Anh (chú ý: "Saterday" giữ theo chuẩn gốc)
  var dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saterday",
  ];

  // Chuyển chuỗi tên ngày và tháng thành chỉ số (index) tương ứng trong mảng
  var day = dayNames.indexOf(dayName);
  var month = monthNames.indexOf(monthName) + 1; // Tháng trong JavaScript tính từ 1-12 khi truyền vào tham số Date(year, month, 0)

  // Xác định tổng số ngày trong tháng (bằng cách lấy ngày 0 của tháng tiếp theo)
  var daysinMonth = new Date(year, month, 0).getDate();

  // Biến đếm tổng số ngày thỏa mãn
  var sumDays = 0;

  // Lặp qua từng ngày trong tháng để so sánh
  for (var i = 1; i <= daysinMonth; i++) {
    // Lấy thứ trong tuần của ngày thứ i (0 = Sunday, 1 = Monday,...)
    var checkDay = new Date(year, month - 1, parseInt(i)).getDay();

    // Nếu thứ trùng khớp thì tăng biến đếm lên 1
    if (day == checkDay) {
      sumDays++;
    }
  }

  // Trả về tổng số ngày đếm được
  return sumDays;
}

/**
 * Loại bỏ toàn bộ dấu tiếng Việt khỏi chuỗi văn bản (Chuyển có dấu -> không dấu).
 *
 * @param {string} text - Chuỗi văn bản tiếng Việt có dấu
 * @return {string} Chuỗi văn bản đã được xóa sạch dấu
 */
function removeAccent(text) {
  // Bỏ dấu cho chữ 'a' và 'A' (bao gồm â, ă và các dấu thanh)
  text = text.replace(/[âấầẩẫậăắằẳẵặ]/g, "a");
  text = text.replace(/[ÂẤẦẨẪẬĂẮẰẲẴẶ]/g, "A");

  text = text.replace(/[áàảãạ]/g, "a");
  text = text.replace(/[ÁÀẢÃẠ]/g, "A");

  // Bỏ dấu cho chữ 'e' và 'E' (bao gồm ê và các dấu thanh)
  text = text.replace(/[éèẻẽẹêếềểễệ]/g, "e");
  text = text.replace(/[ÉÈẺẼẸÊẾỀỂỄỆ]/g, "e");

  // Bỏ dấu cho chữ 'o' và 'O'
  text = text.replace(/[óòỏõọ]/g, "o");
  text = text.replace(/[ÓÒỎÕỌ]/g, "o");

  // Bỏ dấu cho chữ 'đ' và 'Đ'
  text = text.replace(/[đ]/g, "d");
  text = text.replace(/[Đ]/g, "D");

  // Bỏ dấu cho các biến thể 'ô', 'ơ'
  text = text.replace(/[ôốồổỗộơớờởỡợ]/g, "o");
  text = text.replace(/[ÔỐỒỔỖỘƠỚỜỞỠỢ]/g, "O");

  // Bỏ dấu cho chữ 'u' và 'U' (bao gồm ư và các dấu thanh)
  text = text.replace(/[úùủũụưứừửữự]/g, "u");
  text = text.replace(/[ÚÙỦŨỤƯỨỪỬỮỰ]/g, "U");

  // Bỏ dấu cho chữ 'i' và 'I'
  text = text.replace(/[íìỉĩị]/g, "i");
  text = text.replace(/[ÍÌỈĨỊ]/g, "i");

  // Bỏ dấu cho chữ 'y' và 'Y'
  text = text.replace(/[ýỳỷỹỵ]/g, "y");
  text = text.replace(/[ÝỲỶỸỴ]/g, "Y");

  return text;
}

/**
 * Chuyển đổi tên dạng Việt Nam sang dạng Short Name (Tên + Họ).
 * Ví dụ: "Trần Thị Tú Anh" -> "Anh Trần" (Nếu removeAccentFlag = 1 -> "Anh Tran")
 *
 * @param {string} text - Họ và tên đầy đủ
 * @param {number} [removeAccentFlag=0] - 1: Bỏ dấu tiếng Việt, 0: Giữ nguyên dấu
 * @return {string} Chuỗi tên đã được đảo cấu trúc [Tên] + [Họ]
 * @customfunction
 */
function convertVn2FirstLastName(text, removeAccentFlag = 0) {
  // Trả về rỗng nếu chuỗi vào là rỗng
  if (text == "") {
    return "";
  }

  // Cắt bỏ khoảng trắng thừa ở 2 đầu chuỗi
  text = text.trim();

  // Nếu flag = 1 thì thực hiện bỏ dấu tiếng Việt
  if (removeAccentFlag == 1) {
    text = removeAccent(text);
  }

  // Tách chuỗi họ tên thành mảng các từ dựa vào khoảng trắng
  arrTmp = text.split(" ");

  // Ghép: [Từ cuối cùng (Tên)] + [Khoảng trắng] + [Từ đầu tiên (Họ)]
  firstLastName = arrTmp[arrTmp.length - 1] + " " + arrTmp[0];

  return firstLastName;
}

/**
 * Chuyển đổi họ tên Việt Nam sang dạng Full Name chuẩn quốc tế (Tên + Họ + Tên lót).
 * Ví dụ: "Trần Thị Tú Anh" -> "Anh Trần Thị Tú" (Nếu removeAccentFlag = 1 -> "Anh Tran Thi Tu")
 *
 * @param {string} text - Họ và tên đầy đủ
 * @param {number} [removeAccentFlag=0] - 1: Bỏ dấu tiếng Việt, 0: Giữ nguyên dấu
 * @return {string} Chuỗi tên đã chuyển dạng [Tên] + [Họ] + [Các tên lót]
 * @customfunction
 */
function convertVn2FirstFullname(text, removeAccentFlag = 0) {
  if (text == "") {
    return "";
  }

  text = text.trim();
  if (removeAccentFlag == 1) {
    text = removeAccent(text);
  }

  // Tách chuỗi tên thành mảng các từ
  arrTmp = text.split(" ");

  // Lấy từ cuối cùng (Tên chính) làm từ khởi đầu
  firstFullName = arrTmp[arrTmp.length - 1];

  // Nối tiếp các từ còn lại (từ đầu tiên đến cận cuối) vào đằng sau
  for (i = 0; i < arrTmp.length - 1; i++) {
    firstFullName += " " + arrTmp[i];
  }

  return firstFullName;
}

/**
 * Tạo địa chỉ Email/Username từ chuỗi tên đã đảo (dạng FirstFullName không dấu).
 * Ví dụ input: "Anh Tran Thi Tu" -> Output: "anh.tranthitu"
 *
 * @param {string} text - Chuỗi tên dạng FirstFullName (VD: "Anh Tran Thi Tu")
 * @return {string} Tiền tố Email (VD: "anh.tranthitu")
 * @customfunction
 */
function convertFName2EmailAddress(text) {
  if (text == "") {
    return "";
  }

  // Loại bỏ khoảng trắng đầu/cuối và viết thường toàn bộ chuỗi
  text = text.trim().toLowerCase();

  // Tách các từ trong chuỗi tên
  arrTmp = text.split(" ");

  // Tạo phần prefix: [Tên chính] + [Dấu chấm] + [Họ]
  emailAddress = arrTmp[0];
  emailAddress += "." + arrTmp[1];

  // Nối dính liền toàn bộ các tên lót phía sau (nếu có)
  for (i = 2; i < arrTmp.length; i++) {
    emailAddress += "" + arrTmp[i];
  }

  return emailAddress;
}
