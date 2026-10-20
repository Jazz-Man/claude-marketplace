const INJECTION_SUBSTRINGS = [
  "/dev/tcp/",
  "/dev/udp/",
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "HISTFILE",
  ".bash_history",
  "HISTSIZE=0",
];

const isControlByte = (code: number) =>
  (code >= 1 && code <= 8) || (code >= 14 && code <= 31) || code === 127;

const ASCII_WHITESPACE = " \t\n\r";
const ANY_WHITESPACE = /\s/u;
const WORD_SPLIT = /\s+/u;

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

function controlHit(raw: string) {
  for (const char of raw) {
    if (isControlByte(char.codePointAt(0) ?? 0)) {
      return "control characters";
    }
  }
  return null;
}

function pathOverrideHit(raw: string) {
  for (const word of raw.split(WORD_SPLIT)) {
    if (word.startsWith("PATH=") && !word.includes("$PATH")) {
      return "PATH override";
    }
  }
  return null;
}

function whitespaceHit(raw: string) {
  for (const char of raw) {
    if (ANY_WHITESPACE.test(char) && !ASCII_WHITESPACE.includes(char)) {
      return "non-ASCII whitespace";
    }
  }
  return null;
}

export const injectionHit = (raw: string) =>
  substringHit(raw) ??
  controlHit(raw) ??
  pathOverrideHit(raw) ??
  whitespaceHit(raw);
