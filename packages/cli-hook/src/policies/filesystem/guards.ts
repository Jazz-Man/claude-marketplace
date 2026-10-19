// Obfuscation/injection substrings. Pipe-to-exec, eval, and dot-sourcing
// are owned by no-inline-scripts; these are the signals that hide intent.
const INJECTION_SUBSTRINGS = [
  "/dev/tcp/",
  "/dev/udp/",
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "HISTFILE",
  ".bash_history",
  "HISTSIZE=0",
];

// Raw control bytes are never legitimate command text; \v and \f are
// invisible to that byte class and ride the whitespace rule instead —
// whitespace outside " \t\n\r" hides word boundaries from a visual read.
function isControlByte(code: number): boolean {
  return (code >= 1 && code <= 8) || (code >= 14 && code <= 31) || code === 127;
}

const ASCII_WHITESPACE = " \t\n\r";
const ANY_WHITESPACE = /\s/u;
const WORD_SPLIT = /\s+/u;

// The four hit-classes keep the scan's fixed precedence: the first
// non-null wins, so a command carrying several signals reports the
// earliest class' reason.
function substringHit(raw: string): string | null {
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

function controlHit(raw: string): string | null {
  for (const char of raw) {
    if (isControlByte(char.codePointAt(0) ?? 0)) {
      return "control characters";
    }
  }
  return null;
}

function pathOverrideHit(raw: string): string | null {
  for (const word of raw.split(WORD_SPLIT)) {
    if (word.startsWith("PATH=") && !word.includes("$PATH")) {
      return "PATH override";
    }
  }
  return null;
}

function whitespaceHit(raw: string): string | null {
  for (const char of raw) {
    if (ANY_WHITESPACE.test(char) && !ASCII_WHITESPACE.includes(char)) {
      return "non-ASCII whitespace";
    }
  }
  return null;
}

export function injectionHit(raw: string): string | null {
  return (
    substringHit(raw) ??
    controlHit(raw) ??
    pathOverrideHit(raw) ??
    whitespaceHit(raw)
  );
}
