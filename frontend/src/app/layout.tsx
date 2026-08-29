import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "AI Code Reviewer - Intelligent PR & MR Reviews with Gemini",
  description: "Senior AI code reviewer web application powered by Google Gemini, GitHub, and GitLab.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full h-[100dvh] max-h-[100dvh] overflow-hidden" suppressHydrationWarning>
      <body className="h-full h-[100dvh] max-h-[100dvh] bg-background font-sans text-foreground antialiased flex flex-col overflow-hidden m-0 p-0">
        <ThemeProvider>
          <ToastProvider>
            <Navbar />
            <main className="flex-1 overflow-hidden flex flex-col min-h-0 w-full">
              {children}
            </main>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
