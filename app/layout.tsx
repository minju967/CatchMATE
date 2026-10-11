import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import SessionHydrator from '@/components/SessionHydrator';
import './globals.css';

export const metadata: Metadata = {
  title: 'CatchMATE',
  description: '가벼운 상황 질문으로 내가 끌리는 금융습관 유형과 잘 맞는 상대를 찾아보는 테스트',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef1f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1217' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body className="font-sans antialiased">
        <SessionHydrator />
        {/* 틀 없이 화면 전체를 쓴다. 폭에 맞춘 배치는 각 화면(StepShell 의 wide · 본문 max-w)이 정한다 */}
        <div className="app-shell flex min-h-dvh w-full flex-col pb-14">{children}</div>
        <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface px-4 py-2.5 text-center text-[11px] leading-snug text-muted">
          본 서비스의 인물·금융 데이터는 모두 가상으로 생성된 데이터입니다.
        </footer>
      </body>
    </html>
  );
}
