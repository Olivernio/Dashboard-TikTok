"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { Home, Video, Users, Settings, BarChart3, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Streams", href: "/dashboard/streams", icon: Video },
  { name: "Usuarios", href: "/dashboard/users", icon: Users },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Admin", href: "/dashboard/admin", icon: Wrench },
  { name: "Configuración", href: "/dashboard/settings", icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="text-xl font-bold">
                TikTok Stream Dashboard
              </Link>
              <div className="flex items-center gap-1">
                {navigation.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
                  return (
                    <Link key={item.name} href={item.href}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn("gap-2")}
                      >
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </Button>
                    </Link>
                  )
                })}
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </nav>
      <main className="h-[calc(100vh-4rem)]">{children}</main>
    </div>
  )
}

