import { Check, X, SpellCheck, BookOpen, Wand2 } from "lucide-react";
import { Correction } from "@/types/correction";
import { Button } from "@/components/ui/button";

interface SuggestionCardProps {
  correction: Correction;
  onAccept: (id: string, replacement?: string) => void;
  onReject: (id: string) => void;
}

const typeConfig = {
  spelling: {
    icon: SpellCheck,
    label: "Spelling",
    className: "text-error",
    bgClassName: "bg-error-highlight",
  },
  grammar: {
    icon: BookOpen,
    label: "Grammar",
    className: "text-warning",
    bgClassName: "bg-warning/10",
  },
  fluency: {
    icon: Wand2,
    label: "Fluency",
    className: "text-primary",
    bgClassName: "bg-accent",
  },
};

const SuggestionCard = ({ correction, onAccept, onReject }: SuggestionCardProps) => {
  const config = typeConfig[correction.type];
  const Icon = config.icon;

  if (correction.accepted) {
    return (
      <div className="p-3 rounded-lg border border-border bg-fix-highlight/50 opacity-60">
        <div className="flex items-center gap-2 text-xs text-fix">
          <Check className="w-3.5 h-3.5" />
          <span className="line-through">{correction.original}</span>
          <span>→</span>
          <span className="font-medium">{correction.corrected}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`mt-1 p-1.5 rounded-lg ${config.bgClassName}`}>
            <Icon className={`w-4 h-4 ${config.className}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-xs font-bold uppercase tracking-wider ${config.className}`}>{config.label}</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-sm text-destructive line-through decoration-destructive/50">{correction.original}</span>
              <span className="text-muted-foreground">→</span>
              <div className="flex flex-wrap gap-2">
                {correction.replacements.length > 0 ? (
                  correction.replacements.slice(0, 3).map((rep, i) => (
                    <button
                      key={i}
                      onClick={() => onAccept(correction.id, rep)}
                      className="px-2 py-1 text-sm bg-primary/10 text-primary font-semibold rounded hover:bg-primary hover:text-white transition-colors"
                    >
                      {rep}
                    </button>
                  ))
                ) : (
                  <span className="text-sm font-medium text-muted-foreground italic">No suggestion</span>
                )}
              </div>
            </div>
            
            <div className="p-2 bg-muted/30 rounded-md">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Why:</span> {correction.explanation}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onReject(correction.id)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SuggestionCard;
