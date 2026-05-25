import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Triador AIIA | Candidate Intelligence",
  description: "Triagem inteligente de currículos com upload, Gemini, score e histórico auditável.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
