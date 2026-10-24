export const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

export const safeDiv = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? null : a / b);
