export type BookingQueryFilters = {
  apartmentId: string;
  status: string;
  from: string;
  to: string;
  search: string;
};

export const queryKeys = {
  apartments: (includeInactive: boolean) =>
    ["apartments", {includeInactive}] as const,
  bookings: (filters: BookingQueryFilters) => ["bookings", filters] as const,
  dashboard: (dayKey: string) => ["dashboard", dayKey] as const,
  expenses: (monthKey: string) => ["expenses", monthKey] as const,
  pnl: (monthKey: string) => ["pnl", monthKey] as const,
};
