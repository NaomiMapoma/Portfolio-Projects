import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FastTrack",
  description: "Match your real CV to a job description, honestly.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
