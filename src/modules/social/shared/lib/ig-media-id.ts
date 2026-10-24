/** ID media IG = angka; juga mencegah path traversal di route thumbnail. */
export const isMediaId = (id: string) => /^\d{5,30}$/.test(id);
