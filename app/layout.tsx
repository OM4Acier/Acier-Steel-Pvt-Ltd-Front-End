


import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { Toaster as ToasterHot } from 'react-hot-toast';
import { AuthProvider } from "@/components/AuthProvider";
import { LoadingProvider } from "@/context/LoadingContext";


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
      <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >

            <LoadingProvider>
              {children}
              <ToasterHot position="top-center" /> {/* Toaster for notifications */}
              <Toaster position="bottom-right" richColors />
            </LoadingProvider>

          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
