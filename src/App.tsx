import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UserProvider } from "@/contexts/UserContext";
import { Navbar } from "@/components/Navbar";
import { OnboardingModal } from "@/components/OnboardingModal";
import Index from "./pages/Index";
import MarketPage from "./pages/MarketPage";
import CreateMarket from "./pages/CreateMarket";
import Portfolio from "./pages/Portfolio";
import Leaderboard from "./pages/Leaderboard";
import Admin from "./pages/Admin";
import SlotMachine from "./pages/SlotMachine";
import LootBox from "./pages/LootBox";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <UserProvider>
          <Navbar />
          <OnboardingModal />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/market/:id" element={<MarketPage />} />
            <Route path="/create" element={<CreateMarket />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/slots" element={<SlotMachine />} />
            <Route path="/wheel" element={<WheelSpin />} />
            <Route path="/lootbox" element={<LootBox />} />
            <Route path="/lootbox" element={<LootBox />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </UserProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
