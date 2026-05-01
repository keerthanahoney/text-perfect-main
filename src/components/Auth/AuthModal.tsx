import React, { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { auth, googleProvider, appleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleProviderLogin = async (provider: 'google' | 'apple') => {
    setLoading(provider);
    
    const authProvider = provider === 'google' ? googleProvider : appleProvider;
    
    try {
      const result = await signInWithPopup(auth, authProvider);
      // Firebase handles the state, so onAuthStateChanged will pick this up
      toast.success(`Logged in with ${provider === 'google' ? 'Google' : 'Apple'}`);
      onClose();
    } catch (err: any) {
      console.error(`${provider} login error:`, err);
      if (err.code === "auth/popup-closed-by-user") {
        toast.error("Login cancelled. Please try again.");
      } else {
        toast.error(`${provider === 'google' ? 'Google' : 'Apple'} login failed: ${err.message || "Please ensure popups are allowed."}`);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        <div className="bg-primary p-8 flex flex-col items-center justify-center text-primary-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-12 -mb-12 blur-xl" />
          
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg mb-4 rotate-3 animate-in zoom-in duration-300">
            <Wand2 className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight">Welcome Back</DialogTitle>
          <DialogDescription className="text-primary-foreground/80 font-medium text-center mt-2">
            Sign in to unlock history and PDF exports.
          </DialogDescription>
        </div>

        <div className="p-8 space-y-4 bg-card">
          <Button 
            variant="outline" 
            className="w-full h-14 rounded-2xl font-bold text-base border-2 hover:bg-muted/50 transition-all active:scale-95 group relative overflow-hidden"
            onClick={() => handleProviderLogin('google')}
            disabled={!!loading}
          >
            {loading === 'google' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"></path>
                  <path fill="#FBBC05" d="M16.04 18.013c-1.09.636-2.435.987-3.84.987a7.07 7.07 0 0 1-6.865-4.942l-4.025 3.122C3.198 21.302 7.27 24 12 24c3.055 0 5.861-1.108 8.055-3.05l-4.015-2.937Z"></path>
                  <path fill="#4285F4" d="M24 12c0-.84-.076-1.65-.218-2.435H12v4.615h6.73c-.29 1.564-1.173 2.89-2.49 3.771L20.255 20.95C22.5 18.845 24 15.71 24 12Z"></path>
                  <path fill="#34A853" d="M5.266 14.235 1.24 17.357A11.96 11.96 0 0 1 0 12c0-1.92.454-3.733 1.26-5.35l4.006 3.115A7.07 7.07 0 0 0 4.931 12a7.07 7.07 0 0 0 .335 2.235Z"></path>
                </svg>
                Continue with Google
              </>
            )}
          </Button>

          <Button 
            variant="default" 
            className="w-full h-14 rounded-2xl font-bold text-base bg-black text-white hover:bg-black/90 transition-all active:scale-95 group relative overflow-hidden"
            onClick={() => handleProviderLogin('apple')}
            disabled={!!loading}
          >
            {loading === 'apple' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5 mr-3 fill-current" viewBox="0 0 24 24">
                  <path d="M17.05 20.28c-.96.95-2.22 1.5-3.54 1.5-2.77 0-4.88-2.12-4.88-5.33 0-3.23 2.13-5.35 4.88-5.35 1.34 0 2.58.55 3.52 1.52.92.93 1.48 2.22 1.48 3.58 0 1.35-.56 2.65-1.46 3.58zm-1.05-8.3c-.63-.64-1.52-1.02-2.47-1.02-1.92 0-3.37 1.44-3.37 3.65 0 2.22 1.44 3.63 3.37 3.63.97 0 1.86-.38 2.47-1.02.61-.63.98-1.54.98-2.48s-.37-1.84-.98-2.76zM15 8.16c-1.12 0-2.03-.92-2.03-2.05 0-1.13.91-2.05 2.03-2.05s2.03.92 2.03 2.05c0 1.13-.91 2.05-2.03 2.05z" />
                </svg>
                Continue with Apple
              </>
            )}
          </Button>

          <p className="text-[10px] text-center text-muted-foreground uppercase font-bold tracking-widest pt-4">
            Secured by TextPerfect Identity
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
