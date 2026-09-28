const logUrl =
  "https://docs.google.com/spreadsheets/d/1WKf-qJ7ENBn2Az-uXps9gYB1yUtERBRj1TS375sh8Qs/edit?gid=1808971321#gid=1808971321";
/**
 * Lấy đối tượng Sheet từ URL đầy đủ và GID tương ứng
 */
function getSheetByUrlAndGid(url, gid) {
  try {
    // 1. Mở file Google Sheet bằng URL
    const ss = SpreadsheetApp.openByUrl(url);

    // 2. Tìm tab có GID trùng khớp
    const sheets = ss.getSheets();
    return (
      sheets.find(
        (sheet) => sheet.getSheetId().toString() === gid.toString(),
      ) || null
    );
  } catch (error) {
    Logger.log(`❌ Lỗi mở Sheet từ URL [${url}]: ` + error.message);
    return null;
  }
}

/**
 * Ghi log Internal Draft
 * URL: https://docs.google.com/spreadsheets/d/1WKf-qJ7ENBn2Az-uXps9gYB1yUtERBRj1TS375sh8Qs/edit?gid=349228243#gid=349228243
 */
function logInternalWorkflow(data, drafts) {
  const targetGid = "349228243";

  const sheet = getSheetByUrlAndGid(logUrl, targetGid);

  if (!sheet) {
    Logger.log("❌ Không thể ghi log: Không tìm thấy tab Internal Draft Log!");
    return;
  }

  drafts.forEach((draft) => {
    sheet.appendRow([
      new Date(), // Timestamp
      data.fullName, // Fullname
      data.position, // Position
      draft.type, // Request Type (DevOps / HR / IT)
      draft.id, // Draft ID
      "DRAFT_CREATED", // Status
    ]);
  });
  Logger.log("✅ Đã ghi log Internal Draft thành công!");
}

/**
 * Ghi log Candidate Draft
 * URL: https://docs.google.com/spreadsheets/d/1WKf-qJ7ENBn2Az-uXps9gYB1yUtERBRj1TS375sh8Qs/edit?gid=1808971321#gid=1808971321
 */
function logCandidateWorkflow(data, draftId) {
  const targetGid = "1808971321";

  const sheet = getSheetByUrlAndGid(logUrl, targetGid);

  if (!sheet) {
    Logger.log("❌ Không thể ghi log: Không tìm thấy tab Candidate Draft Log!");
    return;
  }

  sheet.appendRow([
    new Date(), // Timestamp
    data.fullName, // Fullname
    data.position, // Position
    data.allocCode, // Alloc Code
    draftId, // Draft ID
    "DRAFT_CREATED", // Status
  ]);
  Logger.log("✅ Đã ghi log Candidate Draft thành công!");
}
