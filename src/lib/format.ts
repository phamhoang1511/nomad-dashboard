/**
 * Định dạng tiền tệ / thời lượng.
 *
 * `fmtVnd` giữ nguyên quy ước rút gọn của file design (tỷ / tr / đ) để các con số
 * lớn không làm vỡ layout card, chỉ khác là xử lý được cả số âm.
 */

/** Rút gọn: 1.25 tỷ · 42.0 tr · 850.000 đ */
export function fmtVnd(value: number): string {
  if (!Number.isFinite(value)) return "0 đ";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)} tỷ`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} tr`;
  return `${Math.round(value).toLocaleString("vi-VN")} đ`;
}

/** Đầy đủ: 1.250.000.000 đ — dùng khi cần con số chính xác. */
export function fmtVndFull(value: number): string {
  if (!Number.isFinite(value)) return "0 đ";
  return `${Math.round(value).toLocaleString("vi-VN")} đ`;
}

/** Số nguyên có phân cách nghìn, không kèm đơn vị (dùng cho ô nhập tiền). */
export function fmtNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  return Math.round(value).toLocaleString("vi-VN");
}

/** Đọc lại số từ ô nhập đã có dấu phân cách. */
export function parseNumber(input: string): number {
  const digits = input.replace(/[^\d-]/g, "");
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Phút tính từ 00:00 → "HH:MM". */
export function fmtHM(minutes: number): string {
  const clamped = Math.max(0, Math.round(minutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Thời lượng người đọc: "3h30" · "45 phút" · "2 đêm". */
export function fmtDuration(minutes: number, type?: "hourly" | "overnight"): string {
  if (type === "overnight") {
    const nights = Math.max(1, Math.round(minutes / (24 * 60)));
    return `${nights} đêm`;
  }
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} phút`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** Tỷ lệ phần trăm với 0 chữ số thập phân, an toàn khi mẫu số bằng 0. */
export function fmtPct(numerator: number, denominator: number): string {
  if (!denominator) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}
