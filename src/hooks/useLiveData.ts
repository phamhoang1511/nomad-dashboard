"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { describeError } from "@/lib/queries";
import { getSupabaseClient } from "@/lib/supabase/client";

export type LiveData<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Kênh realtime đang mở — chấm "Live" ở header phản ánh giá trị này. */
  connected: boolean;
  refresh: () => Promise<void>;
};

type State<T> = {
  data: T | null;
  error: string | null;
  /** Hàm fetcher đã tạo ra `data`. Khác fetcher hiện tại ⇒ đang tải dữ liệu mới. */
  source: (() => Promise<T>) | null;
};

/**
 * Nạp dữ liệu rồi tự làm mới khi có thay đổi ở bảng liên quan (Supabase Realtime)
 * hoặc khi người dùng quay lại tab.
 *
 * `fetcher` phải được bọc `useCallback` — chính identity của nó là tín hiệu nạp
 * lại, thay cho một mảng deps riêng dễ quên đồng bộ.
 */
export function useLiveData<T>(fetcher: () => Promise<T>, tables: string[] = []): LiveData<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: null, source: null });
  const [connected, setConnected] = useState(false);

  // Chỉ nhận kết quả của lần gọi mới nhất — realtime có thể bắn dồn dập.
  const runIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const runId = ++runIdRef.current;
    try {
      const data = await fetcher();
      if (runId === runIdRef.current) setState({ data, error: null, source: fetcher });
    } catch (err) {
      // Giữ lại dữ liệu cũ bên dưới thông báo lỗi thay vì để trang trắng.
      if (runId === runIdRef.current) {
        setState((prev) => ({ data: prev.data, error: describeError(err), source: fetcher }));
      }
    }
  }, [fetcher]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const tableKey = tables.join(",");
  useEffect(() => {
    if (!tableKey) return;
    const supabase = getSupabaseClient();
    const channel = supabase.channel(`live:${tableKey}`);
    for (const table of tableKey.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void refresh();
      });
    }
    channel.subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [tableKey, refresh]);

  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [refresh]);

  return {
    data: state.data,
    // Không cần setState riêng: fetcher đổi là biết ngay đang chờ dữ liệu mới.
    loading: state.source !== fetcher,
    error: state.error,
    connected,
    refresh,
  };
}

/**
 * Đồng hồ dùng chung, tick mỗi giây.
 *
 * Dựng thành external store thay vì state + setInterval để `useSyncExternalStore`
 * lo phần hydration: server render ra `null`, client nhận giờ thật ngay sau đó,
 * không sinh cảnh báo lệch nội dung.
 */
const clock = (() => {
  let current = new Date();
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      timer ??= setInterval(() => {
        current = new Date();
        for (const notify of listeners) notify();
      }, 1000);

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
    getSnapshot: () => current,
    getServerSnapshot: () => null,
  };
})();

export function useNow(): Date | null {
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getServerSnapshot);
}
