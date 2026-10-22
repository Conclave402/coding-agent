// Qualifier Q1: a base unit amount rendered for people.
// Arabic Indic digits in, Latin digits out, comma grouping, 2..decimals fraction digits,
// a negative value spelled with the word "minus", never a dash.

const MINUS_SIGNS = new Set(["-", "\u2212", "\uFE63"]);

function latinDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0) as number;
    if (cp >= 0x0660 && cp <= 0x0669) out += String(cp - 0x0660);
    else if (cp >= 0x06f0 && cp <= 0x06f9) out += String(cp - 0x06f0);
    else out += ch;
  }
  return out;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function plainAmount(value: string, decimals: number, symbol: string): string {
  if (typeof value !== "string") {
    throw new Error("value must be a string of base units");
  }
  if (typeof symbol !== "string") {
    throw new Error("symbol must be a string");
  }
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error("decimals must be a non negative integer");
  }

  let text = latinDigits(value);
  let negative = false;
  const first = text[0];
  if (first !== undefined && MINUS_SIGNS.has(first)) {
    negative = true;
    text = text.slice(1);
  }
  if (!/^[0-9]+$/.test(text)) {
    throw new Error("value must be an integer number of base units");
  }

  const raw = text.replace(/^0+(?=\d)/, "");
  const zero = /^0+$/.test(raw);
  const digits = raw.padStart(decimals + 1, "0");
  const cut = digits.length - decimals;
  const whole = digits.slice(0, cut);
  let fraction = digits.slice(cut);

  const minFraction = Math.min(2, decimals);
  while (fraction.length > minFraction && fraction.endsWith("0")) {
    fraction = fraction.slice(0, -1);
  }

  const amount = groupThousands(whole) + (fraction.length > 0 ? "." + fraction : "");
  const sign = negative && !zero ? "minus " : "";
  const suffix = symbol.length > 0 ? " " + symbol : "";
  return sign + amount + suffix;
}
