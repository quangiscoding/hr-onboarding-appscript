/** ==========================================
 * EMAIL-TEMPLATES.JS - TEMPLATE EMAIL HTML CHÍNH THỨC
 * ========================================== */

/**
 * 1. Template Mail nhắc DevOps (Tạo Email công ty)
 *
 * @param {Object} data - Đối tượng chứa thông tin nhân sự đã được chuẩn hóa
 * @returns {{subject: string, htmlBody: string}}
 */
function getDevOpsEmailTemplate(data) {
  const positionTitle =
    typeof toTitleCase === "function"
      ? toTitleCase(data.position || "")
      : data.position || "";
  const squadTitle =
    typeof toTitleCase === "function"
      ? toTitleCase(data.squad || "")
      : data.squad || "";

  const subject = `Yêu cầu khởi tạo tài khoản email công ty cho nhân sự mới - ${data.fullName || ""}`;

  const htmlBody = `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333333; max-width: 600px; margin: 0;">
  <p style="margin: 0 0 12px 0;">Hi anh Tuấn,</p>
  
  <p style="margin: 0 0 16px 0;">
    Nhờ anh vào file <a href="${data.rowLink}" target="_blank" style="color: #0d6efd; font-weight: bold; text-decoration: underline;">Hera | On-boarding List</a> (dòng <strong>${data.rowNumber}</strong>), hỗ trợ khởi tạo tài khoản email công ty cho nhân sự mới với ạ.
  </p>

  <p style="margin: 0 0 16px 0;">
    Sau khi tạo xong email, nhờ anh chọn dòng <strong>${data.rowNumber}</strong>, truy cập menu <strong>&#128640; Hera Tools</strong> &rarr; chọn <strong>2. Gửi Notification cho TA</strong> để hệ thống tự động gửi email nhắc TA phụ trách ạ.
  </p>
  
  <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0; border-top: 2px solid #EF403E; border-bottom: 1px solid #eeeeee;">
    <tr>
      <td style="padding: 8px 0; color: #666666; width: 130px;">Họ và tên:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${data.fullName || ""}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Email cá nhân:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #EF403E;">${data.personalEmail || ""}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Ngày Onboard:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${data.startDate || ""}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Chức vụ:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${positionTitle}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Squad / Unit:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${squadTitle}</td>
    </tr>
  </table>
  
  <div style="text-align: center; margin: 20px 0 16px 0;">
    <a href="${data.rowLink}" target="_blank" style="background-color: #EF403E; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;">Mở Google Sheet (Dòng ${data.rowNumber})</a>
  </div>
  
  <p style="margin: 0;">Em cảm ơn anh!</p>
</div>`;

  return { subject, htmlBody };
}

/**
 * 2. Template Mail nhắc HR (Tạo Folder OKR)
 * @param {Object} data - Dữ liệu từ getNormalizedInput()
 * @returns {Object} { subject, htmlBody }
 */
function getHREmailTemplate(data) {
  const positionTitle =
    typeof toTitleCase === "function"
      ? toTitleCase(data.position || "")
      : data.position || "";
  const squadTitle =
    typeof toTitleCase === "function"
      ? toTitleCase(data.squad || "")
      : data.squad || "";

  const subject = `Yêu cầu tạo folder OKR onboarding cho nhân sự mới – ${data.fullName || ""}`;

  const htmlBody = `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333333; max-width: 600px; margin: 0;">
  <p style="margin: 0 0 12px 0;">Hi chị Tuyền,</p>
  
  <p style="margin: 0 0 16px 0;">
    Có nhân sự mới sẽ Onboard vào ngày <strong>${data.startDate || ""}</strong>, nhờ chị tiến hành tạo Folder OKRs trên file <a href="${data.rowLink}" target="_blank" style="color: #0d6efd; font-weight: bold; text-decoration: underline;">Hera | On-boarding List</a> (dòng <strong>${data.rowNumber}</strong>) ạ.
  </p>

  <p style="margin: 0 0 16px 0;">
    Sau khi tạo xong Folder OKRs, nhờ chị chọn dòng <strong>${data.rowNumber}</strong>, truy cập menu <strong>&#128640; Hera Tools</strong> &rarr; chọn <strong>2. Gửi Notification cho TA</strong> để hệ thống tự động thông báo đến TA phụ trách ạ.
  </p>
  
  <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0; border-top: 2px solid #EF403E; border-bottom: 1px solid #eeeeee;">
    <tr>
      <td style="padding: 8px 0; color: #666666; width: 130px;">Họ và tên:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${data.fullName || ""}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Email cá nhân:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #EF403E;">${data.personalEmail || ""}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Ngày Onboard:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${data.startDate || ""}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Chức vụ:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${positionTitle}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Squad / Unit:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${squadTitle}</td>
    </tr>
  </table>
  
  <div style="text-align: center; margin: 20px 0 16px 0;">
    <a href="${data.rowLink}" target="_blank" style="background-color: #EF403E; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;">Mở Google Sheet (Dòng ${data.rowNumber})</a>
  </div>
  
  <p style="margin: 0;">Em cảm ơn chị!</p>
</div>`;

  return { subject, htmlBody };
}

/**
 * 3. Template Mail nhắc IT (Cấp máy)
 * @param {Object} data - Dữ liệu từ getNormalizedInput()
 * @returns {Object} { subject, htmlBody }
 */
function getITEmailTemplate(data) {
  const positionTitle = toTitleCase(data.position);
  const squadTitle = toTitleCase(data.squad);

  const subject = `[Thông báo cấp máy] Nhân sự mới ${data.fullName} - ${positionTitle}`;
  const htmlBody = `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333333; max-width: 600px; margin: 0;">
  <p style="margin: 0 0 12px 0;">Hi anh Trung,</p>
  
  <p style="margin: 0 0 16px 0;">
    Em gửi anh thông tin nhân sự sẽ Onboard vào ngày <strong>${data.startDate}</strong> nhờ anh hỗ trợ cấp thiết bị (tra cứu chi tiết tại file <a href="${data.rowLink}" target="_blank" style="color: #0d6efd; font-weight: bold; text-decoration: underline;">Hera | On-boarding List</a> - dòng <strong>${data.rowNumber}</strong>):
  </p>
  
  <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0; border-top: 2px solid #EF403E; border-bottom: 1px solid #eeeeee;">
    <tr>
      <td style="padding: 8px 0; color: #666666; width: 130px;">Họ và tên:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${data.fullName}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Email cá nhân:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #EF403E;">${data.personalEmail}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Ngày Onboard:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${data.startDate}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Chức vụ:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${positionTitle}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Squad / Unit:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${squadTitle}</td>
    </tr>
  </table>
  
  <div style="text-align: center; margin: 20px 0 16px 0;">
    <a href="${data.rowLink}" target="_blank" style="background-color: #EF403E; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;">Mở Google Sheet (Dòng ${data.rowNumber})</a>
  </div>
  
  <p style="margin: 0;">Em cảm ơn anh!</p>
</div>`;

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

  const subject = `[Cập nhật Onboarding] Thông tin tài khoản/folder đã sẵn sàng cho ${data.fullName || ""} (Dòng ${data.rowNumber})`;

  const htmlBody = `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333333; max-width: 600px; margin: 0;">
  <p style="margin: 0 0 12px 0;">Hi ${data.taEmail || "bạn"},</p>
  
  <p style="margin: 0 0 16px 0;">
    Dòng <strong>${data.rowNumber}</strong> trên file <a href="${data.rowLink}" target="_blank" style="color: #0d6efd; font-weight: bold; text-decoration: underline;">Hera | On-boarding List</a> vừa được cập nhật tiến độ mới cho nhân sự <strong>${data.fullName || ""}</strong>.
  </p>

  <p style="margin: 0 0 16px 0;">
    Bạn vui lòng kiểm tra thông tin trên Sheet, chọn dòng <strong>${data.rowNumber}</strong> và truy cập menu <strong>&#128640; Hera Tools</strong> &rarr; chọn <strong>1. Gửi Welcome Email</strong> để tiến hành gửi mail chào mừng cho nhân sự mới nhé.
  </p>
  
  <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0; border-top: 2px solid #EF403E; border-bottom: 1px solid #eeeeee;">
    <tr>
      <td style="padding: 8px 0; color: #666666; width: 130px;">Họ và tên:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${data.fullName || ""}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Email cá nhân:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #EF403E;">${data.personalEmail || ""}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Ngày Onboard:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${data.startDate || ""}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Chức vụ:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${positionTitle}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666666;">Squad / Unit:</td>
      <td style="padding: 8px 0; font-weight: bold; color: #111111;">${squadTitle}</td>
    </tr>
  </table>
  
  <div style="text-align: center; margin: 20px 0 16px 0;">
    <a href="${data.rowLink}" target="_blank" style="background-color: #EF403E; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;">Mở Google Sheet (Dòng ${data.rowNumber})</a>
  </div>
  
  <p style="margin: 0;">Cảm ơn bạn!</p>
</div>`;

  return { subject, htmlBody };
}

/**
 * 5. Template Welcome Email gửi cho Nhân sự mới (Candidate)
 * @param {Object} data - Dữ liệu từ getNormalizedInput()
 * @param {string} guidePreviewUrl - Link preview file PDF trên Google Drive
 * @returns {Object} { subject, htmlBody }
 */
function getWelcomeCandidateEmailTemplate(data, guidePreviewUrl) {
  const positionTitle = toTitleCase(data.position);
  const squadTitle = toTitleCase(data.squad);

  // Format Squad Name hiển thị
  const formattedSquad =
    squadTitle && positionTitle
      ? `${squadTitle} (${positionTitle} Team)`
      : squadTitle || positionTitle;

  // Mapping địa chỉ làm việc dựa trên Onboarding Type
  let officeAddress =
    "Floor 2, Room 2.6, 294-296 Truong Sa, Cau Kieu Ward, Ho Chi Minh City";
  const onboardType = String(data.onboardingType || "").toLowerCase();

  if (onboardType.includes("danang")) {
    officeAddress = "Floor 3, 433-435 Nguyen Huu Tho, Cam Le, Da Nang";
  } else if (onboardType.includes("hoa cau")) {
    officeAddress =
      "Floor 1, Room 1.2, 09 Hoa Cau, Cau Kieu Ward, Ho Chi Minh City";
  }

  const subject = `Welcome to Kyanon Digital: Essential Onboarding Steps for ${positionTitle}_${formattedSquad}`;
  const htmlBody = `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333333; max-width: 650px;">
  <p>Dear <strong>${data.fullName}</strong>,</p>

  <p>Welcome to Kyanon Digital!</p>

  <p>Please find the Onboarding Guide attached. This document contains all the essential steps and logistics you need to prepare before your start date on <strong>${data.startDate}</strong>.</p>

  <p><strong>It covers:</strong></p>
  <ul>
    <li>Required documents.</li>
    <li>
      <strong>First-day Logistics & Work Location:</strong>
      <ul>
        <li><strong>Start Date & Time:</strong> 8:30 AM, ${data.startDate}</li>
        <li><strong>Location:</strong> ${officeAddress}</li>
        <li><strong>Desk Location:</strong> [Insert Desk/Zone/Team Area, e.g., Floor 3 - Hoa Cau Office]</li>
        <li><strong>Check-in:</strong> (Will be activated at 8:30 AM on your start date)</li>
      </ul>
    </li>
    <li>
      <strong>Your Official Email & Password:</strong><br>
      <span style="color: #EF403E; font-weight: bold;">${data.workingEmail}</span> / <code>12#QWEasd</code>
    </li>
    <li>Pre-start tasks (NDA, Company Intro, Security Policy)</li>
  </ul>

  <!-- NÚT BẤM MỞ GUIDE PDF -->
  <div style="text-align: center; margin: 25px 0;">
    <a href="${guidePreviewUrl || "#"}" target="_blank" style="background-color: #EF403E; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">View Essential Onboarding Steps (PDF)</a>
  </div>

  <p>Should you have any questions, please contact <strong>${data.taEmail}</strong> at <strong>[HR CONTACT PHONE]</strong>.</p>

  <p>We look forward to seeing you soon!</p>

  <p>Best regards,<br>
  <strong>[YOUR NAME]</strong><br>
  <em>On behalf of the People Team</em></p>
</div>`;

  return { subject, htmlBody };
}
