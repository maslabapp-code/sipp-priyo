import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIPP — Sistem Informasi Produksi & Pengiriman",
  description: "Sistem tracking stok, PO, dan pengiriman material",
};

const themeInitScript = `
(function() {
  try {
    var theme = localStorage.getItem('mtp-theme');
    if (!theme) theme = 'light';
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full h-full flex flex-col overflow-hidden">{children}</body>
    </html>
  );
}
