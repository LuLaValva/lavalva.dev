// From Bananagrams
const weights = [
  13, 3, 3, 6, 18, 3, 4, 3, 12, 2, 2, 5, 3, 8, 11, 3, 2, 9, 6, 9, 6, 3, 3, 2, 3,
  2,
];

const lookup: number[] = [];
for (let i = 0; i < weights.length; i++) {
  for (let k = 0; k < weights[i]; k++) {
    lookup.push(i);
  }
}

export function requestDay(request: Request) {
  const timeZone = (request as { cf?: { timezone?: string } }).cf?.timezone;
  return new Date(new Date().toLocaleDateString("en-CA", { timeZone }));
}

export function dailyLetters(day: Date, count: number): string[] {
  let seed = Math.floor(+day / 100000);
  return Array.from({ length: count }, () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const idx = Math.floor((seed / 0x100000000) * lookup.length);
    return String.fromCharCode(97 + lookup[idx]);
  });
}

export function binarySearch(list: string[], word: string) {
  let low = 0;
  let high = list.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (list[mid] === word) return true;
    if (list[mid] < word) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return false;
}
