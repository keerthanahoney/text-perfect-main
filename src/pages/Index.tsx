import { useState } from "react";
import Header from "@/components/Header";
import TextEditor from "@/components/TextEditor";
import CorrectedView from "@/components/CorrectedView";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import { useCorrections } from "@/hooks/useCorrections";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const Index = () => {
  const [text, setText] = useState("");

  const {
    corrections,
    correctedText,
    isProcessing,
    processText,
    acceptCorrection,
    applyCorrection,
    rejectCorrection,
    acceptAll,
  } = useCorrections();

  const handleTextChange = (value: string) => {
    setText(value);
    processText(value);
  };

  const handleAccept = (id: string, replacement?: string) => {
    const correction = corrections.find(c => c.id === id);
    if (correction) {
      const newText = applyCorrection(text, correction, replacement);
      setText(newText);
      processText(newText);
      acceptCorrection(id, replacement);
    }
  };

  const handleAcceptAll = () => {
    const newText = acceptAll(text);
    setText(newText);
    processText(newText);
  };

  const handleImprove = async () => {
    if (!text.trim()) return;
    try {
      const response = await fetch(`${apiBaseUrl}/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Improve API request failed:", response.status, response.statusText, errorText);
        return;
      }
      const data = await response.json();
      if (data.improvements && data.improvements.length > 0) {
        import("sonner").then(({ toast }) => {
          data.improvements.forEach((imp: any) => {
            toast.info("Fluency Suggestion", {
              description: imp.suggestion,
              action: {
                label: "Thanks",
                onClick: () => console.log("Suggestion acknowledged")
              }
            });
          });
        });
      }
    } catch (error) {
      console.error("Error improving text:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20 relative overflow-hidden">
      {/* Dynamic Background Blurs */}
      <div className="absolute top-0 -left-10 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
      <div className="absolute top-0 -right-10 w-96 h-96 bg-indigo-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-20 left-40 w-96 h-96 bg-pink-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
      
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 container mx-auto px-6 py-10 max-w-[1600px]">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-5xl font-extrabold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400">
                Writing Dashboard
              </h2>
              <p className="text-muted-foreground font-medium text-lg">
                Real-time context-aware corrections powered by <span className="font-semibold text-primary">AI</span>.
              </p>
            </div>
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setText("");
                  processText("");
                }}
                className="h-12 rounded-2xl font-semibold px-6 border-2 hover:bg-muted/50 transition-all"
              >
                Clear All
              </Button>
              <Button
                onClick={handleImprove}
                className="h-12 rounded-2xl font-bold px-8 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:scale-95 transition-all bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0"
              >
                <Wand2 className="w-5 h-5 mr-2" />
                Improve Fluency
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-280px)] min-h-[600px]">
            <div className="lg:col-span-6 rounded-3xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-indigo-500/10">
              <TextEditor
                value={text}
                onChange={handleTextChange}
                isProcessing={isProcessing}
                corrections={corrections}
              />
            </div>
            <div className="lg:col-span-3 rounded-3xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-purple-500/10">
              <CorrectedView 
                originalText={text} 
                correctedText={correctedText} 
                corrections={corrections} 
                isProcessing={isProcessing}
                onApply={(newText) => {
                  setText(newText);
                  processText(newText);
                }}
              />
            </div>
            <div className="lg:col-span-3 rounded-3xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-pink-500/10">
              <SuggestionsPanel
                corrections={corrections}
                onAccept={handleAccept}
                onReject={rejectCorrection}
                onAcceptAll={handleAcceptAll}
              />
            </div>
          </div>

          <div className="mt-10 flex items-center justify-center gap-8 bg-white/30 dark:bg-black/30 backdrop-blur-md py-3 px-8 rounded-full w-max mx-auto border border-white/20 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Spelling Errors</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Grammar Issues</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">AI Refinement</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
