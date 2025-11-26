import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "TikTok Stream Dashboard",
  description: "Dashboard para analizar streams de TikTok en tiempo real",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

