export const INJECTION_SUBSTRINGS = [
  "/dev/tcp/",
  "/dev/udp/",
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "HISTFILE",
  ".bash_history",
  "HISTSIZE=0",
];

export const WORD_SPLIT = /\s+/u;

// biome-ignore lint/suspicious/noControlCharactersInRegex: raw control bytes are exactly what this scan detects
const CONTROL_CHARS = /[\x01-\x08\x0e-\x1f\x7f]/u;

const WEIRD_WHITESPACE = new RegExp(
  "[\\x0b\\x0c\\xa0" +
    String.fromCharCode(0x16_80, 0x20_00) +
    "-" +
    String.fromCharCode(0x20_28, 0x20_29, 0x20_2f, 0x20_5f, 0x30_00, 0xfe_ff) +
    "]",
  "u",
);

function substringHit(raw: string) {
  for (const needle of INJECTION_SUBSTRINGS) {
    if (raw.includes(needle)) {
      return needle;
    }
  }
  if (raw.includes("\0")) {
    return "null byte";
  }
  return null;
}

function pathOverrideHit(raw: string) {
  if (!raw.includes("PATH=")) {
    return null;
  }
  for (const word of raw.split(WORD_SPLIT)) {
    if (word.startsWith("PATH=") && !word.includes("$PATH")) {
      return "PATH override";
    }
  }
  return null;
}

export const injectionHit = (raw: string) => {
  const hit = substringHit(raw);
  if (hit !== null) {
    return hit;
  }
  if (CONTROL_CHARS.test(raw)) {
    return "control characters";
  }
  const override = pathOverrideHit(raw);
  if (override !== null) {
    return override;
  }
  return WEIRD_WHITESPACE.test(raw) ? "non-ASCII whitespace" : null;
};
