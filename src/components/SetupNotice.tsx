/**
 * Màn hình thay thế khi chưa có biến môi trường Supabase. Xuất hiện thay vì một
 * lỗi runtime khó hiểu ở lần chạy đầu tiên.
 */
export function SetupNotice() {
  const steps = [
    {
      title: "Tạo project Supabase",
      body: "supabase.com/dashboard → New project. Chọn region Singapore cho độ trễ thấp.",
    },
    {
      title: "Chạy migration",
      body: "Mở SQL Editor, dán toàn bộ supabase/migrations/0001_init.sql rồi Run.",
    },
    {
      title: "Tạo tài khoản đăng nhập",
      body: "Authentication → Users → Add user. Nhớ bật Auto Confirm User.",
    },
    {
      title: "Điền .env.local",
      body: "Copy .env.local.example thành .env.local, dán URL và anon key từ Project Settings → API, rồi khởi động lại npm run dev.",
    },
  ];

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-[560px]">
        <div className="mb-8">
          <div className="eyebrow mb-2 tracking-[2px]">Cần cài đặt</div>
          <h1 className="font-display text-[32px] leading-tight font-semibold">
            Chưa kết nối được Supabase
          </h1>
          <p className="mt-3 text-[14px] text-muted">
            Thiếu <code className="rounded bg-surface-inset px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            hoặc{" "}
            <code className="rounded bg-surface-inset px-1.5 py-0.5">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>
            . Làm 4 bước dưới đây là xong.
          </p>
        </div>

        <ol className="card flex flex-col gap-5 p-8">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-wash font-display text-[14px] font-semibold text-gold-ink">
                {index + 1}
              </span>
              <div>
                <div className="text-[14.5px] font-semibold">{step.title}</div>
                <div className="mt-1 text-[13px] leading-relaxed text-muted">{step.body}</div>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-5 text-center text-[12px] text-muted-soft">
          Hướng dẫn đầy đủ nằm ở supabase/README.md
        </p>
      </div>
    </div>
  );
}
