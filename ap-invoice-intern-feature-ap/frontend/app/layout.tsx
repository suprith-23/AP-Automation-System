import "./globals.css";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";

/**
 * next/font handles font loading with:
 * - Zero render-blocking requests (fonts are self-hosted by Next.js)
 * - Automatic size-adjust / font-display:optional to prevent FOUT
 * - CSS variable injection for use in Tailwind / global CSS
 */
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
  preload: true,
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
  preload: false, // secondary font, lazy
});

export const metadata = {
  title: "AutoFlow — AP Automation System",
  description:
    "Enterprise Accounts Payable Automation — Approver, Reviewer, Admin workflows",
};

import { Toaster } from "sonner";
import ConfirmDialog from "../components/ui/ConfirmDialog";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
         * Inline theme script: runs synchronously before any paint.
         * Prevents the FOUC (Flash of Unstyled Content) when the user
         * prefers dark mode — sets the `dark` class on <html> before
         * React hydrates, so no light→dark flash occurs.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='dark'||(!(\"theme\" in localStorage)&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(_){}`,
          }}
        />
      </head>
      <body
        className={`${plusJakarta.variable} ${inter.variable} antialiased selection:bg-green-400/20`}
      >
        {children}
        <ConfirmDialog />
        <Toaster 
          position="top-right" 
          richColors 
          closeButton 
          toastOptions={{
            style: {
              maxWidth: '380px',
              right: '16px',
            },
            className: "break-words whitespace-pre-wrap max-w-sm right-4"
          }}
        />
      </body>
    </html>
  );
}
