import { Moon, Sun, LogOut, User as UserIcon, ChevronDown, LogIn } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import AuthModal from "./Auth/AuthModal";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Header = () => {
  const { theme, setTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="TextPerfect logo" className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-primary/20 bg-card" />
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">TextPerfect</h1>
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-70">Context-Aware AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full w-10 h-10 hover:bg-accent transition-colors"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 flex items-center gap-2 pl-2 pr-1 rounded-full hover:bg-accent transition-colors">
                  <Avatar className="h-8 w-8 border border-border shadow-sm">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                      {user?.full_name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col items-start mr-1">
                    <span className="text-xs font-bold leading-none">{user?.full_name}</span>
                    <span className="text-[10px] text-muted-foreground mt-1 leading-none">{user?.email}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 mt-2 rounded-2xl p-2 shadow-2xl" align="end">
                <DropdownMenuLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground px-3 py-2">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem className="rounded-xl px-3 py-2.5 cursor-pointer group">
                  <UserIcon className="mr-3 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-semibold text-sm">Writing History</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="rounded-xl px-3 py-2.5 cursor-pointer group text-destructive focus:text-destructive hover:bg-destructive/10"
                  onClick={logout}
                >
                  <LogOut className="mr-3 h-4 w-4 text-destructive/70 group-hover:text-destructive transition-colors" />
                  <span className="font-bold text-sm">Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button 
              variant="default" 
              size="sm"
              onClick={() => setIsAuthModalOpen(true)}
              className="rounded-full px-6 font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          )}
        </div>
      </div>
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </header>
  );
};

export default Header;
