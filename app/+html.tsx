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
          type="image/png"
          href={`/assets/images/favicon.png?v=${FAVICON_VERSION}`}
        />
        <link
          rel="shortcut icon"
          type="image/png"
          href={`/assets/images/favicon.png?v=${FAVICON_VERSION}`}
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
