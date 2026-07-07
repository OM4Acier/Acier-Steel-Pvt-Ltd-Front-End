


import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { Toaster as ToasterHot } from 'react-hot-toast';
import { LoadingProvider } from "@/context/LoadingContext";
import { NavbarExtensionProvider } from "@/context/NavbarExtensionContext";
import { AppShell } from "@/components/AppShell";
import { ClerkProvider } from "@clerk/nextjs";
import { ClerkTokenProvider } from "@/providers/ClerkTokenProvider";


const nunitoSans = Nunito({
  variable: "--font-nunito-sans",
  subsets: ["latin"],

});

export const metadata: Metadata = {
  title: "ACIER STEEL PVT. LTD. | NSC",
  description: "TALOJA MIDC",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${nunitoSans.className} antialiased`}
      >
        <ClerkProvider>
          <ClerkTokenProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <NavbarExtensionProvider>
                <LoadingProvider>
                  <AppShell>
                    {children}
                    <ToasterHot position="top-center" /> {/* Toaster for notifications */}
                    <Toaster position="bottom-right" richColors />

                  </AppShell>

                </LoadingProvider>

              </NavbarExtensionProvider>

            </ThemeProvider>
          </ClerkTokenProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
