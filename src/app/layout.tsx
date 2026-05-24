import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voxray — Voice Agent Observability",
  description: "Real-time error detection for Ultravox voice AI agents. Catch mistakes, apply fixes, track error rate by prompt version.",
  metadataBase: new URL('https://voxray.vercel.app'),
  openGraph: {
    title: "Voxray — Voice Agent Observability",
    description: "Real-time error detection for Ultravox voice AI agents. Catch mistakes, apply fixes, track error rate by prompt version.",
    url: 'https://voxray.vercel.app',
    siteName: 'Voxray',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Voxray — Voice Agent Observability",
    description: "Real-time error detection for Ultravox voice AI agents.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('voxray-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
