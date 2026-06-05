import {
  extractProviderLinksFromWatchHtml,
  type WatchProviderInput,
} from '../../src/services/tmdb-watch-links';

describe('extractProviderLinksFromWatchHtml', () => {
  it('mapea enlaces por proveedor y decodifica el parámetro r', () => {
    const providers: WatchProviderInput[] = [
      {
        provider_id: 337,
        provider_name: 'Disney Plus',
        logo_path: '/disney-logo.jpg',
      },
      {
        provider_id: 119,
        provider_name: 'Amazon Prime Video',
        logo_path: '/prime-logo.jpg',
      },
    ];

    const html = `
      <div>
        <a class="ott_provider"
          title="Disney Plus"
          href="https://click.justwatch.com/a?r=https%253A%252F%252Fwww.disneyplus.com%252Fes-es%252Fmovies%252Finside-out-2%252Fabc123&amp;utm_source=tmdb">
          <img src="https://image.tmdb.org/t/p/original/disney-logo.jpg" alt="Disney+" />
        </a>
        <a class="ott_provider"
          title="Prime Video"
          href="https://click.justwatch.com/a?r=https%3A%2F%2Fapp.primevideo.com%2Fdetail%2Fxyz789&amp;utm_source=tmdb">
          <img data-src="https://image.tmdb.org/t/p/original/prime-logo.jpg" alt="Prime Video" />
        </a>
      </div>
    `;

    const links = extractProviderLinksFromWatchHtml(html, providers);

    expect(links[337]).toBe('https://www.disneyplus.com/es-es/movies/inside-out-2/abc123');
    expect(links[119]).toBe('https://app.primevideo.com/detail/xyz789');
  });

  it('mapea por nombre si no puede usar logo', () => {
    const providers: WatchProviderInput[] = [
      {
        provider_id: 2,
        provider_name: 'Apple TV Plus',
        logo_path: '/apple-logo.jpg',
      },
    ];

    const html = `
      <div>
        <a href="https://click.justwatch.com/a?r=https%3A%2F%2Ftv.apple.com%2Fes%2Fshow%2Fxyz%2F123">
          <span aria-label="Apple TV+">Apple TV+</span>
        </a>
      </div>
    `;

    const links = extractProviderLinksFromWatchHtml(html, providers);

    expect(links[2]).toBe('https://tv.apple.com/es/show/xyz/123');
  });
});
