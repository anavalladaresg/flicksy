/**
 * E2E Tests con Detox
 * Nota: Requiere configuración adicional de Detox
 */

describe('Home Screen Flow', () => {
  beforeAll(async () => {
    // await device.launchApp();
  });

  beforeEach(async () => {
    // await device.reloadReactNative();
  });

  it('should display popular movies on home screen', async () => {
    // await expect(element(by.text('Películas Populares'))).toBeVisible();
  });

  it('should navigate to movie details', async () => {
    // await waitFor(element(by.id('movie-card-1')))
    //   .toExist()
    //   .withTimeout(5000);
    // await element(by.id('movie-card-1')).multiTap();
    // await expect(element(by.text('Movie Title'))).toBeVisible();
  });

  it('should add movie to tracked library', async () => {
    // await element(by.id('add-button')).multiTap();
    // await element(by.text('Agregar a Biblioteca')).multiTap();
    // await expect(element(by.text('Agregada'))).toBeVisible();
  });

  it('should navigate to tracked library', async () => {
    // await element(by.id('library-tab')).multiTap();
    // await expect(element(by.text('Mi Biblioteca'))).toBeVisible();
  });

  it('should search for movies', async () => {
    // await element(by.id('search-tab')).multiTap();
    // await element(by.id('search-input')).typeText('inception');
    // await waitFor(element(by.text('Inception')))
    //   .toExist()
    //   .withTimeout(5000);
  });
});
