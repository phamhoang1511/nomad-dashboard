"use client";

import { useCallback, useState } from "react";

import { ApartmentFormDialog } from "@/components/apartments/ApartmentFormDialog";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, EmptyState, ErrorNote, LoadingRows } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLiveData } from "@/hooks/useLiveData";
import { fmtVndFull } from "@/lib/format";
import { TABLES, deleteApartment, describeError, listApartments } from "@/lib/queries";
import { APARTMENT_STATUS_LABEL, type Apartment } from "@/lib/types";

const STATUS_TONE: Record<Apartment["status"], { bg: string; fg: string }> = {
  active: { bg: "var(--color-sage-wash)", fg: "var(--color-sage-deep)" },
  paused: { bg: "var(--color-gold-soft)", fg: "var(--color-gold-ink)" },
  archived: { bg: "var(--color-surface-inset)", fg: "var(--color-muted)" },
};

export default function ApartmentsPage() {
  const fetcher = useCallback(() => listApartments(true), []);
  const { data, loading, error, refresh } = useLiveData(fetcher, [TABLES.apartments]);

  const [editing, setEditing] = useState<Apartment | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Apartment | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const apartments = data ?? [];

  async function confirmRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      await deleteApartment(removing.id);
      setRemoving(null);
      await refresh();
    } catch (err) {
      setRemoveError(describeError(err));
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={`Danh mục · ${apartments.length} căn`}
        title="Căn hộ"
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            + Thêm căn hộ
          </Button>
        }
      />

      <div className="card p-6 md:p-7">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {loading ? (
          <LoadingRows rows={4} />
        ) : apartments.length === 0 ? (
          <EmptyState
            title="Chưa có căn hộ nào"
            hint="Thêm căn hộ đầu tiên để bắt đầu ghi booking và chi phí. Mỗi căn cần một mã riêng, ví dụ MSB.3301."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                + Thêm căn hộ
              </Button>
            }
          />
        ) : (
          <div className="scroll-slim overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b border-line text-left text-[11.5px] font-semibold tracking-[1px] text-muted-soft uppercase">
                  <th className="pb-3">Mã căn</th>
                  <th className="pb-3">Tên / Toà nhà</th>
                  <th className="pb-3 text-right">Giá theo giờ</th>
                  <th className="pb-3 text-right">Giá qua đêm</th>
                  <th className="pb-3 text-center">Dọn</th>
                  <th className="pb-3">Trạng thái</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {apartments.map((a) => (
                  <tr key={a.id} className="border-b border-line-soft last:border-0">
                    <td className="py-4 text-[15px] font-semibold">{a.code}</td>
                    <td className="py-4 text-[13.5px] text-muted">
                      {a.name ?? "—"}
                      {a.building ? (
                        <span className="text-muted-soft"> · {a.building}</span>
                      ) : null}
                    </td>
                    <td className="py-4 text-right font-display text-[16px] tabular-nums">
                      {fmtVndFull(a.hourly_rate)}
                    </td>
                    <td className="py-4 text-right font-display text-[16px] tabular-nums">
                      {fmtVndFull(a.nightly_rate)}
                    </td>
                    <td className="py-4 text-center text-[13px] text-muted tabular-nums">
                      {a.cleaning_buffer_minutes}′
                    </td>
                    <td className="py-4">
                      <Badge {...STATUS_TONE[a.status]}>{APARTMENT_STATUS_LABEL[a.status]}</Badge>
                    </td>
                    <td className="py-4">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                          Sửa
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRemoveError(null);
                            setRemoving(a);
                          }}
                        >
                          Xoá
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating || editing ? (
        <ApartmentFormDialog
          apartment={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={refresh}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title={`Xoá ${removing.code}?`}
          busy={removeBusy}
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
          body={
            <div className="flex flex-col gap-3">
              <p>
                Xoá căn hộ sẽ xoá theo <strong>toàn bộ booking và chi phí</strong> đã ghi cho căn
                này. Số liệu lợi nhuận tích luỹ sẽ thay đổi và không khôi phục được.
              </p>
              <p>
                Nếu chỉ muốn ngừng khai thác, hãy bấm <strong>Huỷ</strong> rồi sửa trạng thái căn
                thành <strong>Lưu trữ</strong> — dữ liệu cũ được giữ nguyên.
              </p>
              {removeError ? <ErrorNote>{removeError}</ErrorNote> : null}
            </div>
          }
        />
      ) : null}
    </>
  );
}
