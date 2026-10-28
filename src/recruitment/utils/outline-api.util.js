/**
 * utils/outline-api.util.js
 * Xử lý dữ liệu thuần, không side-effects, không gọi UI hay external API.
 */
class OutlineApiUtil {
  /**
   * Che giấu bớt token để hiển thị an toàn trên UI
   * @param {string} token
   * @returns {string}
   */
  static maskToken(token) {
    if (!token || typeof token !== "string") return "";
    const trimmed = token.trim();
    if (trimmed.length <= 12) return "********";
    return `${trimmed.substring(0, 8)}...${trimmed.substring(trimmed.length - 4)}`;
  }

  /**
   * Xây markdown của post "Welcome Onboard" theo mẫu bài đăng internal.
   * @param {Object} candidate - Dữ liệu ứng viên từ Sheet
   * @param {string} introduction - Đoạn intro do người dùng soạn/AI sinh ra
   * @returns {{ title: string, text: string }}
   */
  static buildWelcomePostMarkdown(candidate, introduction) {
    const data = candidate || {};
    const name = data.fullName || "New Member";
    const jobTitle = data.title || "N/A";
    const firstDay = data.dateOfOnboard || "N/A";
    const manager = data.lineManager || "N/A";
    const squad = data.squad ? `${data.squad} — ` : "";
    const introText = (introduction || "").trim();

    const title = `Welcome Onboard: ${name}`;
    const text = [
      `**First working day:** ${firstDay}`,
      `**Job Title:** ${jobTitle}`,
      `**Line Manager:** ${manager}`,
      `**Introduction:** ${introText}`,
      "",
      `_Squad/Unit: ${squad || "N/A"} | Employment Type: ${data.employmentType || "N/A"} | Level: ${data.level || "N/A"}_`,
    ].join("\n\n");

    return { title, text };
  }
}
