export interface Position {
  character: number;
  line: number;
}

export interface ContentChange {
  range?: { end: Position; start: Position };
  text: string;
}

export interface DocState {
  languageId: string;
  text: string;
}

type StoredDoc = DocState & { uri: string };

function offsetOf(text: string, position: Position): number {
  const lines = text.split("\n");
  const clampedLine = Math.min(position.line, lines.length - 1);
  let offset = 0;
  for (const line of lines.slice(0, clampedLine)) {
    offset += line.length + 1;
  }
  const target = lines.at(clampedLine);
  if (target === undefined) {
    return offset;
  }
  return offset + Math.min(position.character, target.length);
}

function applyOne(text: string, change: ContentChange): string {
  if (change.range === undefined) {
    return change.text;
  }
  const start = offsetOf(text, change.range.start);
  const end = Math.max(start, offsetOf(text, change.range.end));
  return text.slice(0, start) + change.text + text.slice(end);
}

export function applyChanges(text: string, changes: ContentChange[]): string {
  let current = text;
  for (const change of changes) {
    current = applyOne(current, change);
  }
  return current;
}

export class DocumentStore {
  private readonly documents = new Map<string, StoredDoc>();

  open(uri: string, languageId: string, text: string): void {
    this.documents.set(uri, { languageId, text, uri });
  }

  change(uri: string, changes: ContentChange[]): void {
    const document = this.documents.get(uri);
    if (document !== undefined) {
      document.text = applyChanges(document.text, changes);
    }
  }

  close(uri: string): void {
    this.documents.delete(uri);
  }

  get(uri: string): DocState | undefined {
    const document = this.documents.get(uri);
    if (document === undefined) {
      return undefined;
    }
    return { languageId: document.languageId, text: document.text };
  }

  entries(): StoredDoc[] {
    return [...this.documents.values()];
  }
}
