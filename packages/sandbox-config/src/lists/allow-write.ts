/**
 * sandbox.filesystem.allowWrite — paths sandboxed commands may write beyond
 * the working directory and TMPDIR. This list is this key's alone; see
 * config.ts for why lists never share entries.
 */

// Carved out of the sandbox's default write-deny (everything outside the
// working dir and TMPDIR): Darwin's per-user temp tree, where xcrun keeps
// its cache DB and build tools spill intermediates. Both spellings because
// /var is a symlink to /private/var and the matcher's symlink resolution
// is unverified.
export const allowWrite = ["~/.cache", "/var/folders", "/private/var/folders"];
