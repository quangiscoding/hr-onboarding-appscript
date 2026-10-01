/** ==========================================
 * EMAIL-TEMPLATES.JS - ĐÃ RÚT GỌN & TÁCH HTML
 * ========================================== */

function getDevOpsEmailTemplate(data) {
  const payload = {
    ...data,
    positionTitle:
      typeof toTitleCase === "function"
        ? toTitleCase(data.position || "")
        : data.position || "",
    squadTitle:
      typeof toTitleCase === "function"
        ? toTitleCase(data.squad || "")
        : data.squad || "",
  };

  const subject = `Yêu cầu khởi tạo tài khoản email công ty cho nhân sự mới - ${data.fullName || ""}`;
  const htmlBody = renderHtmlTemplate("devops-email", payload);

  return { subject, htmlBody };
}

function getHREmailTemplate(data) {
  const payload = {
    ...data,
    positionTitle:
      typeof toTitleCase === "function"
        ? toTitleCase(data.position || "")
        : data.position || "",
    squadTitle:
      typeof toTitleCase === "function"
        ? toTitleCase(data.squad || "")
        : data.squad || "",
  };

  const subject = `Yêu cầu tạo folder OKR onboarding cho nhân sự mới – ${data.fullName || ""}`;
  const htmlBody = renderHtmlTemplate("hr-email", payload);

  return { subject, htmlBody };
}

function getITEmailTemplate(data) {
  const positionTitle =
    typeof toTitleCase === "function"
      ? toTitleCase(data.position || "")
      : data.position || "";
  const squadTitle =
    typeof toTitleCase === "function"
      ? toTitleCase(data.squad || "")
      : data.squad || "";

  const payload = { ...data, positionTitle, squadTitle };
  const subject = `[Thông báo cấp máy] Nhân sự mới ${data.fullName} - ${positionTitle}`;
  const htmlBody = renderHtmlTemplate("it-email", payload);

  return { subject, htmlBody };
}

/**
 * 4. Template Notification Email gửi cho TA In Charge
 * @param {Object} data - Dữ liệu từ getNormalizedInput()
 * @returns {Object} { subject, htmlBody }
 */
function getTaNotificationEmailTemplate(data) {
  const positionTitle =
    typeof toTitleCase === "function"
      ? toTitleCase(data.position || "")
      : data.position || "";
  const squadTitle =
    typeof toTitleCase === "function"
      ? toTitleCase(data.squad || "")
      : data.squad || "";

  // Lấy username bỏ đuôi @domain (vd: nguyen.trt@kyanon.digital -> nguyen.trt)
  const rawTa = data.taEmail || "bạn";
  const taUsername = rawTa.includes("@") ? rawTa.split("@")[0] : rawTa;

  // 1. Kiểm tra trạng thái dữ liệu 2 cột
  const hasOkr = Boolean(
    data.okrFolderUrl && String(data.okrFolderUrl).trim() !== "",
  );
  const hasEmail = Boolean(
    data.allocCode && String(data.allocCode).trim() !== "",
  );

  // 2. Phân nhánh câu thông báo & tiêu đề theo 3 trường hợp
  let statusMessage = "";
  let subjectDetail = "";

  if (hasOkr && hasEmail) {
    subjectDetail = "Cả Folder OKRs và Email công ty đã sẵn sàng";
    statusMessage = `Cả <strong>Folder OKRs</strong> và <strong>Email công ty (Working Email)</strong> cho nhân sự <strong>${data.fullName || ""}</strong> (dòng <strong>${data.rowNumber}</strong>) đã được tạo hoàn tất.`;
  } else if (hasOkr) {
    subjectDetail = "Folder OKRs đã sẵn sàng";
    statusMessage = `Đã có <strong>Folder OKRs</strong> cho nhân sự <strong>${data.fullName || ""}</strong> tại dòng <strong>${data.rowNumber}</strong>.`;
  } else if (hasEmail) {
    subjectDetail = "Working Email đã được tạo";
    statusMessage = `<strong>Working email</strong> đã được tạo cho nhân sự <strong>${data.fullName || ""}</strong> tại dòng <strong>${data.rowNumber}</strong>.`;
  } else {
    // Fallback nếu chưa có thông tin ở cả 2 cột
    subjectDetail = "Thông tin tiến độ đã được cập nhật";
    statusMessage = `Dòng <strong>${data.rowNumber}</strong> vừa được cập nhật tiến độ mới cho nhân sự <strong>${data.fullName || ""}</strong>.`;
  }

  const payload = {
    ...data,
    taUsername,
    positionTitle,
    squadTitle,
    statusMessage,
  };

  const subject = `[Cập nhật Onboarding] ${subjectDetail} - ${data.fullName || ""} (Dòng ${data.rowNumber})`;
  const htmlBody = renderHtmlTemplate("ta-notification-email", payload);

  return { subject, htmlBody };
}

function getWelcomeCandidateEmailTemplate(data, guidePreviewUrl) {
  const positionTitle =
    typeof toTitleCase === "function"
      ? toTitleCase(data.position || "")
      : data.position || "";
  const squadTitle =
    typeof toTitleCase === "function"
      ? toTitleCase(data.squad || "")
      : data.squad || "";
  const formattedSquad =
    squadTitle && positionTitle
      ? `${squadTitle} (${positionTitle} Team)`
      : squadTitle || positionTitle;

  let officeAddress =
    "Floor 2, Room 2.6, 294-296 Truong Sa, Cau Kieu Ward, Ho Chi Minh City";
  const onboardType = String(data.onboardingType || "").toLowerCase();
  if (onboardType.includes("danang")) {
    officeAddress = "Floor 3, 433-435 Nguyen Huu Tho, Cam Le, Da Nang";
  } else if (onboardType.includes("hoa cau")) {
    officeAddress =
      "Floor 1, Room 1.2, 09 Hoa Cau, Cau Kieu Ward, Ho Chi Minh City";
  }

  const payload = {
    ...data,
    positionTitle,
    squadTitle,
    formattedSquad,
    officeAddress,
    guidePreviewUrl,
  };

  const subject = `Welcome to Kyanon Digital: Essential Onboarding Steps for ${positionTitle}_${formattedSquad}`;
  const htmlBody = renderHtmlTemplate("welcome-candidate-email", payload);

  return { subject, htmlBody };
}
