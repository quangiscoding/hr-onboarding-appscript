/**
 * utils/ai-provider.util.js
 * Quản lý prompt và chuẩn bị dữ liệu gửi tới các AI Model.
 */
class AiProviderUtil {
  /**
   * Dựng prompt tiếng Anh theo style bài Welcome Onboard mẫu
   * @param {Object} candidate - Thông tin ứng viên
   * @returns {string} Prompt text
   */
  static buildWelcomePrompt(candidate) {
    const data = candidate || {};
    return [
      "You are an HR teammate writing a warm, energetic, and professional 'Welcome Onboard' introduction paragraph.",
      "Write it in ENGLISH, 4-5 sentences. Follow the naming conventions, tone, and sentence structure shown in the examples below.",
      "",
      "Few-shot Examples (Learn the phrasing style based on seniority):",
      "",
      "[Example 1 - Senior/Experienced Role]:",
      '"We are thrilled to welcome Ms. Tuyen Tran as our People Specialist in Hera! 🌟 Tuyen brings over 5 years of hands-on experience in C&B and HR Operations across tech and corporate environments. She excels in payroll management, social insurance, and internal engagement. With her empathetic mindset and meticulous approach, she is well-equipped to bring fresh energy to our team. Welcome aboard, Tuyen! 🚀"',
      "",
      "[Example 2 - Experienced Role with English Name]:",
      '"We are excited to welcome Ms. Ngan Nguyen (Nancy) as our Talent Development Specialist in Hera! 🎉 Ms. Ngan brings over 7 years of professional experience in HR and TA within the tech industry across APAC, SEA, and EMEA regions. Her background highlights strong expertise in technical recruiting and global talent acquisition. With this extensive expertise, she will play a vital role in sourcing top-tier tech talents and driving recruitment excellence. Welcome aboard, Nancy! 🚀✨"',
      "",
      "[Example 3 - Intern/Junior Role]:",
      '"We are delighted to welcome Mr. Khoi Thanh Dinh as our Business Development Intern! 🌟 Khoi is a student majoring in Business Management at the University of Greenwich. He has proven hands-on experience in leadership, event coordination, and stakeholder negotiation from his role as President of the Peer Mentoring Club. Armed with solid skills in research, communication, and task management, he is ready to bring his proactive mindset to the team. Welcome aboard, Khoi! 🚀"',
      "",
      "Naming & Formatting Rules:",
      "1. Opening Sentence: Start with 'We are excited/thrilled/delighted to welcome <Ms./Mr.> <FullName (EnglishName if present)> as our <Job Title> in <Squad> Team! 🎉' (or 🌟 / ✨).",
      "2. Body & Closing Sentences: STRICTLY use ONLY the First Name or English Name (e.g., 'Nancy', 'Tuyen', 'Khoi', 'Ngan'). NEVER repeat the full name.",
      "3. Tailor Content:",
      "   - For Experienced roles: Focus on YOE, regional/industry experience, core domain mastery, and strategic impact.",
      "   - For Intern/Fresh roles: Focus on University, Major, Club leadership, GPA/IELTS, key soft skills, and readiness.",
      "4. Closing Sentence: Use 'Welcome aboard, <FirstName/EnglishName>! 🚀' or '🚀✨'.",
      "5. STRICT CONSTRAINT: Output ONLY the introduction paragraph. Do NOT include titles, 'First working day:', or markdown headers.",
      "",
      "Candidate context:",
      `- Full name: ${data.fullName || "New Member"}`,
      `- Job title: ${data.title || "N/A"}`,
      `- Squad/Unit: ${data.squad || "N/A"}`,
      `- Employment type: ${data.employmentType || "N/A"}`,
    ].join("\n");
  }

  /**
   * Trích xuất danh sách key từ Properties (hỗ trợ phẩy và hậu tố _2.._10)
   * @param {string} baseKey - Ví dụ "GEMINI_API_KEY" hoặc "OPENROUTER_API_KEY"
   * @returns {string[]}
   */
  static extractApiKeysFromProps(baseKey) {
    const props = PropertiesService.getScriptProperties();
    const keys = [];

    const first = props.getProperty(baseKey);
    if (first) {
      keys.push(
        ...first
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      );
    }

    for (let i = 2; i <= 10; i++) {
      const k = props.getProperty(`${baseKey}_${i}`);
      if (k) keys.push(k.trim());
      else break;
    }

    return keys;
  }
}
