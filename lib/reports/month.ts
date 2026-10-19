const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-09" → "September 2026" (laporan berbahasa Inggris). */
export const enMonth = (m: string) => `${EN_MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
