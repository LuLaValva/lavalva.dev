export function requestDay(request: Request) {
  const timeZone = (request as { cf?: { timezone?: string } }).cf?.timezone;
  return new Date(
    `${new Date().toLocaleDateString("en-CA", { timeZone })}T00:00Z`,
  );
}

export function dailyPicker(day: Date) {
  let seed = Math.floor(+day / 100000);
  return <T>(items: readonly T[]) => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return items[Math.floor((seed / 0x100000000) * items.length)];
  };
}

export const vibrate = (pattern: number | number[]) =>
  navigator.vibrate?.(pattern);
