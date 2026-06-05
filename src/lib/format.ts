import { format, parseISO } from "date-fns";

export const todayISO = () => format(new Date(), "yyyy-MM-dd");
export const fmtDate = (iso: string) => {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
};
export const fmtTime = (t: string) => t;
