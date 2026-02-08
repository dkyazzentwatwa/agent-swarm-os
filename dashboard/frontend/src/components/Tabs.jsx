import { useState } from "react";
import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  defaultTab,
  onChange,
  className,
  tabsClassName,
  contentClassName,
}) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.value);

  const handleTabChange = (value) => {
    setActiveTab(value);
    onChange?.(value);
  };

  const activeTabData = tabs.find((t) => t.value === activeTab);

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        className={cn(
          "flex items-center gap-1 border-b border-border",
          tabsClassName
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={cn(
              "px-3 py-2 text-sm font-medium transition-colors relative",
              activeTab === tab.value
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-2">
              {tab.icon && <span className="text-base">{tab.icon}</span>}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    activeTab === tab.value
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </span>
            {activeTab === tab.value && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
            )}
          </button>
        ))}
      </div>
      <div className={cn("pt-4", contentClassName)}>
        {activeTabData?.content}
      </div>
    </div>
  );
}

export function TabsList({ children, className }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 border-b border-border",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, active, onClick, children, className }) {
  return (
    <button
      onClick={() => onClick?.(value)}
      className={cn(
        "px-3 py-2 text-sm font-medium transition-colors relative",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
      )}
    </button>
  );
}
