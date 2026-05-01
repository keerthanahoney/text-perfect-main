import { CheckCheck, SpellCheck, BookOpen, Wand2 } from "lucide-react";
import { Correction } from "@/types/correction";
import { Button } from "@/components/ui/button";
import SuggestionCard from "./SuggestionCard";

interface SuggestionsPanelProps {
  corrections: Correction[];
  onAccept: (id: string, replacement?: string) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
}

const SuggestionsPanel = ({ corrections, onAccept, onReject, onAcceptAll }: SuggestionsPanelProps) => {
  const pending = corrections.filter((c) => !c.accepted);
  const spelling = corrections.filter((c) => c.type === "spelling").length;
  const grammar = corrections.filter((c) => c.type === "grammar" || c.type === "fluency").length;
  const fluency = corrections.filter((c) => c.type === "fluency").length;

  return (
    <div className="border-t lg:border-t-0 lg:border-l border-border bg-card/50">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Suggestions ({corrections.length})
        </span>
        {pending.length > 0 && (
          <Button
            size="sm"
            onClick={onAcceptAll}
            className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Fix All
          </Button>
        )}
      </div>

      {corrections.length > 0 && (
        <div className="px-4 py-3 border-b border-border flex gap-3">
          {spelling > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SpellCheck className="w-3.5 h-3.5 text-error" />
              <span>{spelling}</span>
            </div>
          )}
          {grammar > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookOpen className="w-3.5 h-3.5 text-warning" />
              <span>{grammar}</span>
            </div>
          )}
          {fluency > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wand2 className="w-3.5 h-3.5 text-primary" />
              <span>{fluency}</span>
            </div>
          )}
        </div>
      )}

      <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
        {corrections.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4 border border-primary/10">
              <CheckCheck className="w-8 h-8 text-primary/40" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Perfectly Clear!</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We haven't found any errors yet. Keep writing and we'll analyze your text in real-time.
            </p>
          </div>
        ) : (
          corrections.map((c) => (
            <SuggestionCard
              key={c.id}
              correction={c}
              onAccept={onAccept}
              onReject={onReject}
            />
          ))
        )}
      </div>

      {corrections.length > 0 && (
        <div className="mt-auto p-4 border-t border-border bg-muted/20">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Writing Insights</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-card border border-border">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Readability</p>
              <p className="text-sm font-bold text-primary">High</p>
            </div>
            <div className="p-2 rounded-lg bg-card border border-border">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Tone</p>
              <p className="text-sm font-bold text-primary">Professional</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuggestionsPanel;
