/** ?y=YYYY, selain itu tahun berjalan. */
export const pickYear = (param: string | undefined, now: Date) => (param && /^\d{4}$/.test(param) ? param : String(now.getFullYear()));
