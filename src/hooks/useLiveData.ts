"use client";

import {useEffect, useEffectEvent, useState, useSyncExternalStore} from "react";
import {useQuery, useQueryClient, type QueryKey} from "@tanstack/react-query";

import {getSupabaseClient} from "@/lib/supabase/client";
import {describeError} from "@/lib/utils/queries";

export type LiveData<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  refresh: () => Promise<void>;
};

export function useLiveData<T>(
  queryKey: QueryKey,
  fetcher: () => Promise<T>,
  tables: string[] = [],
): LiveData<T> {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  const {
    data,
    error,
    isFetching,
    isPending,
    isPlaceholderData,
    refetch,
  } = useQuery<T, Error>({
    queryKey,
    queryFn: fetcher,
    placeholderData: (prev) => prev,
  });

  const tableKey = tables.join(",");
  const invalidateCurrentQuery = useEffectEvent(() => {
    void queryClient.invalidateQueries({queryKey});
  });

  useEffect(() => {
    if (!tableKey) return;
    const supabase = getSupabaseClient();
    const channel = supabase.channel(`live:${tableKey}`);
    for (const table of tableKey.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        invalidateCurrentQuery();
      });
    }
    channel.subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [tableKey]);

  return {
    data: data ?? null,
    loading: isPending || (isFetching && isPlaceholderData),
    error: error ? describeError(error) : null,
    connected,
    refresh: async () => {
      await refetch();
    },
  };
}

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