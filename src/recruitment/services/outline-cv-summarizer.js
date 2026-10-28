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
      throw new Error(
        "Thiếu thông tin ứng viên. Hãy chọn lại dòng và mở lại sidebar.",
      );
    }

    let aiRes = null;
    const timeStart = new Date();

    try {
      // 1. Đọc nội dung CV
      const cvContent = CvReaderService.readCvContent(
        formData && formData.cvFile,
        candidate,
      );

      // 2. Gọi AI tóm tắt
      aiRes = AiProviderService.summarizeCv(cvContent, candidate);
      const timeEnd = new Date();

      // 3. Ghi log thành công
      this.logCost_({
        fullName: candidate.fullName,
        provider: aiRes.provider,
        model: aiRes.model,
        timeStart: timeStart,
        timeEnd: timeEnd,
        inputTokens: aiRes.inputTokens,
        outputTokens: aiRes.outputTokens,
        status: "SUCCESS",
      });

      return {
        ok: true,
        introduction: aiRes.text,
      };
    } catch (error) {
      const timeEnd = new Date();
      Logger.log("❌ OutlineCvSummarizerService lỗi: " + error.toString());

      // Ghi log thất bại
      this.logCost_({
        fullName: candidate?.fullName || "N/A",
        provider: aiRes?.provider || "N/A",
        model: aiRes?.model || "N/A",
        timeStart: timeStart,
        timeEnd: timeEnd,
        inputTokens: aiRes?.inputTokens || 0,
        outputTokens: aiRes?.outputTokens || 0,
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
