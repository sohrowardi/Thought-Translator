export enum Tone {
  Friendly = 'Friendly',
  Humorous = 'Humorous',
  Professional = 'Professional',
}

export interface HistoryEntry {
  id: string;
  input: string;
  output: string;
  tone: Tone;
  outputLanguage: string;
  timestamp: number;
}
