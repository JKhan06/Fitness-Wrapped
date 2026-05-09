import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fitness Wrapped",
  description: "Your yearly health + fitness wrapped",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}