import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "sonner";
import { Toaster as ToasterHot } from "react-hot-toast";

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
      <body className={`${nunitoSans.className} antialiased`}>
        <Providers>
          <AppShell>
            {children}
            <ToasterHot position="top-center" /> {/* Toaster for notifications */}
            <Toaster position="bottom-right" richColors />
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
