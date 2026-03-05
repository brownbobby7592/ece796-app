import { Bluetooth, Activity, LineChart, FolderOpen } from "lucide-react";

interface BottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export function BottomNav({ currentTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: "scan", label: "Scan", icon: Bluetooth },
    { id: "live", label: "Live", icon: Activity },
    { id: "plots", label: "Plots", icon: LineChart },
    { id: "files", label: "Files", icon: FolderOpen },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 safe-area-bottom">
      <div className="max-w-md mx-auto flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                isActive ? "text-blue-500" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
