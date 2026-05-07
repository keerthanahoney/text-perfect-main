import { Correction } from "@/types/correction";
import { Check, Copy, Download, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

interface CorrectedViewProps {
  originalText: string;
  correctedText?: string;
  corrections: Correction[];
  isProcessing?: boolean;
  onApply?: (text: string) => void;
}

const CorrectedView = ({ originalText, correctedText, corrections, isProcessing, onApply }: CorrectedViewProps) => {
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { isAuthenticated } = useAuth();

  const handleCopy = () => {
    if (correctedText) {
      navigator.clipboard.writeText(correctedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Text copied to clipboard");
    }
  };

  const handleApply = () => {
    if (correctedText && onApply) {
      onApply(correctedText);
      toast.success("Editor updated with polished version");
    }
  };

  const handleDownloadPDF = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to download PDF exports");
      return;
    }
    if (!correctedText) {
      toast.warning("Please wait for the AI to finish polishing your text first.");
      return;
    }
    
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const splitText = doc.splitTextToSize(correctedText, contentWidth);
      
      const lineSpacing = 7;
      let y = 55;
      const maxBottomY = pageHeight - margin - 15;
      let pageCount = 1;

      const drawPageDecorations = (pageNum: number) => {
        // Professional Border
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.5);
        doc.rect(margin - 5, margin - 5, pageWidth - 2 * margin + 10, pageHeight - 2 * margin + 10);
        
        if (pageNum === 1) {
          doc.setFontSize(22);
          doc.setTextColor(33, 33, 33);
          doc.setFont("helvetica", "bold");
          doc.text("TextPerfect Corrected Output", margin, 30);
          
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.setFont("helvetica", "normal");
          doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, 38);
          
          doc.setDrawColor(200, 200, 200);
          doc.line(margin, 43, pageWidth - margin, 43);
        }
      };

      drawPageDecorations(1);

      for (let i = 0; i < splitText.length; i++) {
        if (y > maxBottomY) {
          doc.addPage();
          pageCount++;
          y = margin + 10;
          drawPageDecorations(pageCount);
        }
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.setFont("helvetica", "normal");
        doc.text(splitText[i], margin, y);
        y += lineSpacing;
      }
      
      // Footer with conditional page numbers
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        if (pageCount > 1) {
          doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - margin + 2, { align: "center" });
        }
        doc.text("Professional AI Writing Assistant", margin, pageHeight - margin + 2);
      }
      
      const pdfBlob = doc.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "corrected_text.pdf");
      link.setAttribute("type", "application/pdf");
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      toast.success("PDF download started! File: corrected_text.pdf");
    } catch (err) {
      console.error("PDF Export Error:", err);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  if (!originalText.trim()) {
    return (
      <div className="flex flex-col h-full bg-card/30">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <span className="text-sm font-medium text-foreground">Polished Result</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-muted-foreground text-sm text-center">
            Your perfectly polished writing will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card/30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium text-foreground">Polished Version</span>
        </div>
        <div className="flex items-center gap-2">
          {onApply && correctedText && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleApply}
              className="h-8 px-2 gap-1.5 text-xs font-semibold hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <Check className="w-3.5 h-3.5 text-green-500" />
              Sync with Editor
            </Button>
          )}
          {correctedText && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="h-8 px-2 gap-1.5 text-xs font-semibold hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              {isExporting ? "Exporting..." : "Download PDF"}
            </Button>
          )}
          {correctedText && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-2 gap-1.5 text-xs font-semibold hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 p-6 overflow-auto custom-scrollbar relative">
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] z-10 animate-in fade-in duration-200">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">AI is polishing...</p>
          </div>
        )}
        <div className={`text-base leading-relaxed whitespace-pre-wrap font-sans text-foreground/90 selection:bg-primary/20 transition-all duration-300 ${isProcessing ? 'opacity-40 blur-[1px]' : ''}`}>
          {correctedText || originalText}
        </div>
      </div>
      <div className="p-4 border-t border-border bg-muted/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Target Quality</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-3 h-1 rounded-full bg-green-500/40" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CorrectedView;
