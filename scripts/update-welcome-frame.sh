#!/usr/bin/env bash
# ==========================================
# UPDATE-WELCOME-FRAME.SH - CẬP NHẬT KHUNG WELCOME CARD MẶC ĐỊNH CHO SIDEBAR
# ==========================================
# Apps Script không push được file ảnh (.webp/.png/.jpg) — ảnh khung được nhúng
# dưới dạng data URI base64 vào src/recruitment/welcome-frame.html; sidebar sẽ
# inject sẵn khung này mỗi lần mở (không cần mạng, không làm canvas bị taint).
#
# Cách dùng:
#   1. Thay ảnh khung tại src/assets/frame.webp (hoặc truyền đường dẫn ảnh khác)
#      — khuyến nghị: có vùng trong suốt ở giữa để ảnh ứng viên hiện ra
#        (canvas vẽ avatar trước, khung phủ đè lên sau, tự scale về 1000x1000)
#   2. Chạy:  ./scripts/update-welcome-frame.sh
#   3. Push:  pnpm push   (clasp push)
set -euo pipefail

SRC="${1:-src/assets/frame.webp}"
OUT="src/recruitment/welcome-frame.html"

case "${SRC,,}" in
  *.png)       MIME="png" ;;
  *.jpg|*.jpeg) MIME="jpeg" ;;
  *.webp)      MIME="webp" ;;
  *) echo "❌ Chỉ hỗ trợ .webp / .png / .jpg — file: $SRC"; exit 1 ;;
esac

if [ ! -f "$SRC" ]; then
  echo "❌ Không tìm thấy ảnh nguồn: $SRC"
  echo "   Hoặc truyền đường dẫn: ./scripts/update-welcome-frame.sh <đường/đẫn/ảnh.webp>"
  exit 1
fi

SIZE=$(stat -c%s "$SRC")
echo "Ảnh nguồn : $SRC ($(numfmt --to=iec "$SIZE" 2>/dev/null || echo "${SIZE}B"))"
if [ "$SIZE" -gt 1500000 ]; then
  echo "⚠️  Ảnh lớn hơn 1.5MB — sidebar sẽ mở chậm. Nên nén lại (<500KB) rồi chạy lại."
fi

printf 'data:image/%s;base64,%s' "$MIME" "$(base64 -w0 "$SRC")" > "$OUT"
echo "Đã sinh   : $OUT"
echo "Tiếp theo : chạy 'pnpm push' để cập nhật lên Apps Script."
