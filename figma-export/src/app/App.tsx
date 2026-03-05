import { useState } from "react";
import { AppProvider } from "./context/AppContext";
import { BottomNav } from "./components/BottomNav";
import { ScanScreen } from "./components/ScanScreen";
import { LiveScreen } from "./components/LiveScreen";
import { PlotsScreen } from "./components/PlotsScreen";
import { FilesScreen } from "./components/FilesScreen";

export default function App() {
  const [currentTab, setCurrentTab] = useState("scan");

  const renderScreen = () => {
    switch (currentTab) {
      case "scan":
        return <ScanScreen />;
      case "live":
        return <LiveScreen />;
      case "plots":
        return <PlotsScreen />;
      case "files":
        return <FilesScreen />;
      default:
        return <ScanScreen />;
    }
  };

  return (
    <AppProvider>
      <div className="h-screen flex flex-col bg-gray-950 text-gray-100 max-w-md mx-auto">
        <div className="flex-1 overflow-hidden">
          {renderScreen()}
        </div>
        <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />
      </div>
    </AppProvider>
  );
}
