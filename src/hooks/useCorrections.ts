import { useState, useCallback, useRef } from "react";
import { Correction, CorrectionResult } from "@/types/correction";
import { diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL } from "diff-match-patch";

const dmp = new diff_match_patch();

async function fetchCorrections(text: string): Promise<CorrectionResult> {
  if (!text.trim()) return { correctedText: text, corrections: [] };

  try {
    const response = await fetch("http://localhost:8000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) throw new Error("Failed to fetch corrections");

    const data = await response.json();
    
    // We use the backend's correctedText and matches
    const corrections: Correction[] = data.matches.map((match: any) => ({
      id: match.id,
      original: match.original,
      corrected: match.corrected,
      replacements: match.replacements,
      type: match.category.toLowerCase().includes("spelling") ? "spelling" : "grammar",
      explanation: match.explanation,
      startIndex: match.offset,
      endIndex: match.offset + match.length,
    }));

    return { correctedText: data.correctedText, corrections };
  } catch (error) {
    console.error("Error fetching corrections:", error);
    return { correctedText: text, corrections: [] };
  }
}

export function useCorrections() {
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [correctedText, setCorrectedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const processText = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim()) {
      setCorrections([]);
      setCorrectedText("");
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    debounceRef.current = setTimeout(async () => {
      const result = await fetchCorrections(text);
      setCorrections(result.corrections);
      setCorrectedText(result.correctedText);
      setIsProcessing(false);
    }, 800);
  }, []);

  // Safe sentence-level or token-level replacement
  const applyCorrection = useCallback((currentText: string, correction: Correction, replacement?: string) => {
    const finalReplacement = replacement || correction.corrected;
    
    // Find the original snippet in the current text to be sure we are replacing the right thing
    // even if indexes have shifted slightly (though we try to keep them in sync)
    const originalSnippet = currentText.slice(correction.startIndex, correction.endIndex);
    
    if (originalSnippet === correction.original) {
      return currentText.slice(0, correction.startIndex) + 
             finalReplacement + 
             currentText.slice(correction.endIndex);
    } else {
      // Fallback: try to find the original text in the vicinity if indexes shifted
      const searchStart = Math.max(0, correction.startIndex - 20);
      const searchEnd = Math.min(currentText.length, correction.endIndex + 20);
      const vicinity = currentText.slice(searchStart, searchEnd);
      const indexInVicinity = vicinity.indexOf(correction.original);
      
      if (indexInVicinity !== -1) {
        const absoluteIndex = searchStart + indexInVicinity;
        return currentText.slice(0, absoluteIndex) + 
               finalReplacement + 
               currentText.slice(absoluteIndex + correction.original.length);
      }
    }
    
    return currentText;
  }, []);

  const acceptCorrection = useCallback((id: string, replacement?: string) => {
    setCorrections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, accepted: true, corrected: replacement || c.corrected } : c))
    );
  }, []);

  const rejectCorrection = useCallback((id: string) => {
    setCorrections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const acceptAll = useCallback((text: string) => {
    // Instead of multiple partial replacements, we use the backend's correctedText
    // but only if all corrections were intended to be accepted.
    // To be safer and follow "Full Sentence Replacement", we can reconstruct it.
    
    let resultText = text;
    const sorted = [...corrections]
      .filter(c => !c.accepted)
      .sort((a, b) => b.startIndex - a.startIndex);
      
    for (const c of sorted) {
      resultText = applyCorrection(resultText, c);
    }
    
    setCorrections((prev) => prev.map((c) => ({ ...c, accepted: true })));
    return resultText;
  }, [corrections, applyCorrection]);

  return {
    corrections,
    correctedText,
    isProcessing,
    processText,
    acceptCorrection,
    applyCorrection,
    rejectCorrection,
    acceptAll,
  };
}

