"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Video } from "lucide-react"
import { cn } from "@/lib/utils"
import { StreamSelector } from "@/components/dashboard/stream-selector"

interface CollapsibleSidebarProps {
  children?: React.ReactNode
}

export function CollapsibleSidebar({ children }: CollapsibleSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div
      className={cn(
        "relative border-r bg-background transition-all duration-300 ease-in-out h-full flex flex-col",
        isCollapsed ? "w-16" : "w-80"
      )}
    >
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "absolute -right-3 top-4 z-10 h-6 w-6 rounded-full border bg-background shadow-sm",
          "hover:bg-accent"
        )}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isCollapsed ? (
          <div className="flex flex-col items-center py-4 space-y-4">
            <Video className="h-6 w-6 text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden p-4">
            {children || <StreamSelector />}
          </div>
        )}
      </div>
    </div>
  )
}

