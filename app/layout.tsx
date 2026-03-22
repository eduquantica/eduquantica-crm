/* CRITICAL - DO NOT REMOVE globals.css IMPORT */
/* This import is required for ALL Tailwind styling */
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import EduviChatWidget from "@/components/EduviChatWidget";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Eduquantica CRM",
  description: "Education CRM Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
          <EduviChatWidget sessionType="PUBLIC_VISITOR" hideOnAuthRoutes />
        </Providers>
      </body>
    </html>
  );
}
