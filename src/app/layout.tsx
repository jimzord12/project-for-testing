import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reflective Maturity Profile",
  description:
    "A privacy-first, reflective self-assessment of maturity-related behaviors. Not a diagnosis.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
