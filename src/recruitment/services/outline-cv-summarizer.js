/**
 * services/outline-cv-summarizer.service.js
 * Domain Service cho tính năng tóm tắt CV ứng viên.
 */
class OutlineCvSummarizerService {
  /**
   * Thực thi toàn bộ luồng đọc CV, tóm tắt qua AI và ghi log chi phí
   * @param {Object} formData - { candidate, cvFile }
   * @returns {{ ok: boolean, introduction?: string, error?: string }}
   */
  static generateCandidateIntroduction(formData) {
    const candidate = formData && formData.candidate;
    if (!candidate || !candidate.fullName) {
      throw new Error("Thiếu thông tin ứng viên. Hãy chọn lại dòng và mở lại sidebar.");
    }

    let aiRes = null;
    const timeStart = new Date();

    try {
      // 1. Đọc nội dung CV
      const cvContent = CvReaderService.readCvContent(formData && formData.cvFile, candidate);

      // 2. Gọi AI tóm tắt qua n8n
      const rawRes = AiProviderService.summarizeCv(cvContent, candidate);

      // Xử lý trường hợp n8n trả về mảng [ { ... } ]
      aiRes = Array.isArray(rawRes) ? rawRes[0] : rawRes;

      if (!aiRes || aiRes.ok === false) {
        throw new Error(aiRes?.error || "n8n xử lý tóm tắt CV không thành công.");
      }

      const timeEnd = new Date();
      const log = aiRes.logRow || {};

      // 3. Ghi log thành công: Map chính xác các key từ logRow vào logger.js
      this.logCost_({
        userEmail: log["User Call"] || candidate.callerEmail,
        fullName: log["Fullname"] || candidate.fullName,
        provider: log["Provider"] || "openrouter",
        model: log["Model"] || "google/gemini-2.5-flash",
        timeStart: log["Time Start"] || timeStart,
        timeEnd: log["Time End"] || timeEnd,
        latency: log["Latency (s)"],
        inputTokens: log["Input Tokens"],
        outputTokens: log["Output Tokens"],
        priceInput: log["Price Input ($/1M)"],
        priceOutput: log["Price Output ($/1M)"],
        totalCost: log["Total Cost ($)"],
        status: log["Status"] || "SUCCESS",
        errorDetail: log["Error Details"] || "",
      });

      return {
        ok: true,
        introduction: aiRes.introduction || "",
      };
    } catch (error) {
      const timeEnd = new Date();
      Logger.log("❌ OutlineCvSummarizerService lỗi: " + error.toString());

      const log = (Array.isArray(aiRes) ? aiRes[0] : aiRes)?.logRow || {};

      // Ghi log thất bại
      this.logCost_({
        userEmail: log["User Call"] || candidate?.callerEmail,
        fullName: candidate?.fullName || "N/A",
        provider: log["Provider"] || "openrouter",
        model: log["Model"] || "N/A",
        timeStart: log["Time Start"] || timeStart,
        timeEnd: log["Time End"] || timeEnd,
        latency: log["Latency (s)"] || 0,
        inputTokens: log["Input Tokens"] || 0,
        outputTokens: log["Output Tokens"] || 0,
        priceInput: log["Price Input ($/1M)"],
        priceOutput: log["Price Output ($/1M)"],
        totalCost: log["Total Cost ($)"] || 0,
        status: "FAILED",
        errorDetail: error.message || error.toString(),
      });

      throw error;
    }
  }

  /**
   * Helper an toàn ghi log (ủy quyền cho logAiCostWorkflow của core/logger)
   * @private
   */
  static logCost_(logData) {
    try {
      if (typeof logAiCostWorkflow === "function") {
        logAiCostWorkflow(logData);
      }
    } catch (e) {
      Logger.log("⚠️ Không thể ghi log AI Cost: " + e.message);
    }
  }
}
