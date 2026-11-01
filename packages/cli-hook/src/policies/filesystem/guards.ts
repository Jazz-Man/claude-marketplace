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

const WORD_SPLIT = /\s+/u;

function isNonAsciiWhitespace(code: number): boolean {
  return (
    code === 11 ||
    code === 12 ||
    code === 0xa0 ||
    code === 0x16_80 ||
    (code >= 0x20_00 && code <= 0x20_0a) ||
    code === 0x20_28 ||
    code === 0x20_29 ||
    code === 0x20_2f ||
    code === 0x20_5f ||
    code === 0x30_00 ||
    code === 0xfe_ff
  );
}

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

function scanRaw(raw: string): { control: boolean; weirdWs: boolean } {
  let weirdWs = false;
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (isControlByte(code)) {
      return { control: true, weirdWs };
    }
    if (!weirdWs && isNonAsciiWhitespace(code)) {
      weirdWs = true;
    }
  }
  return { control: false, weirdWs };
}

function pathOverrideHit(raw: string) {
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
  const scan = scanRaw(raw);
  if (scan.control) {
    return "control characters";
  }
  const override = pathOverrideHit(raw);
  if (override !== null) {
    return override;
  }
  return scan.weirdWs ? "non-ASCII whitespace" : null;
};
