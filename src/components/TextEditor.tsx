import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Correction } from "@/types/correction";

interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
  isProcessing: boolean;
  corrections: Correction[];
}

const TextEditor = ({ value, onChange, isProcessing, corrections }: TextEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(400, textareaRef.current.scrollHeight)}px`;
    }
  }, [value]);

  const handleScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const renderHighlightedText = () => {
    if (!value) return null;

    const sortedCorrections = [...corrections]
      .filter(c => !c.accepted)
      .sort((a, b) => a.startIndex - b.startIndex);

    const parts = [];
    let lastIndex = 0;

    sortedCorrections.forEach((correction, index) => {
      // Add text before correction
      if (correction.startIndex > lastIndex) {
        parts.push(value.slice(lastIndex, correction.startIndex));
      }

      // Add highlighted correction
      const typeClass = correction.type === "spelling" 
        ? "border-b-2 border-red-500 decoration-red-500 underline-offset-4" 
        : "border-b-2 border-blue-500 decoration-blue-500 underline-offset-4";

      parts.push(
        <span
          key={`${correction.id}-${index}`}
          className={`cursor-pointer ${typeClass} bg-transparent`}
          title={correction.explanation}
        >
          {value.slice(correction.startIndex, correction.endIndex)}
        </span>
      );

      lastIndex = correction.endIndex;
    });

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push(value.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-semibold tracking-tight">AI EDITOR</span>
        </div>
        <div className="flex items-center gap-4">
          {isProcessing && (
            <div className="flex items-center gap-2 text-primary animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-bold tracking-wide uppercase">AI is thinking...</span>
            </div>
          )}
          <div className="h-4 w-[1px] bg-border mx-1" />
          <span className="text-xs font-mono text-muted-foreground uppercase">
            {value.split(/\s+/).filter(Boolean).length} words
          </span>
        </div>
      </div>
      
      <div className="relative flex-1 p-8 overflow-hidden group">
        {/* The Overlay for highlights */}
        <div
          ref={overlayRef}
          className="absolute inset-8 pointer-events-none whitespace-pre-wrap break-words text-base leading-relaxed font-sans text-transparent select-none overflow-auto"
          aria-hidden="true"
        >
          {renderHighlightedText()}
        </div>

        {/* The actual Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          placeholder="Start typing your masterpiece..."
          className="w-full h-full min-h-[400px] resize-none bg-transparent text-foreground placeholder:text-muted-foreground/30 focus:outline-none text-base leading-relaxed font-sans relative z-10 selection:bg-primary/20"
          spellCheck={false}
        />
        
        <div className="absolute bottom-4 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest bg-background/80 backdrop-blur-sm px-2 py-1 rounded border border-border">
            Real-time Analysis Active
          </p>
        </div>
      </div>
    </div>
  );
};

export default TextEditor;
