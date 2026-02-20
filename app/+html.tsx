import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

const FAVICON_VERSION = '20260220';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <link
          rel="icon"
          type="image/x-icon"
          href={`/favicon.ico?v=${FAVICON_VERSION}`}
        />
        <link
          rel="shortcut icon"
          type="image/x-icon"
          href={`/favicon.ico?v=${FAVICON_VERSION}`}
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href={`/favicon.png?v=${FAVICON_VERSION}`}
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href={`/apple-touch-icon.png?v=${FAVICON_VERSION}`}
        />
        <style>{`
          [data-testid="floating-modal-sheet"] * {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          [data-testid="floating-modal-sheet"] *::-webkit-scrollbar {
            width: 0;
            height: 0;
          }
        `}</style>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
