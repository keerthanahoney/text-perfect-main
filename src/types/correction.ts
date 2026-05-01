export interface Correction {
  id: string;
  original: string;
  corrected: string;
  replacements: string[];
  type: "spelling" | "grammar" | "fluency";
  explanation: string;
  startIndex: number;
  endIndex: number;
  accepted?: boolean;
}

export interface CorrectionResult {
  correctedText: string;
  corrections: Correction[];
}
