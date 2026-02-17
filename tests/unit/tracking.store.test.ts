/**
 * Tests unitarios para el store de tracking
 */

import { useTrackingStore } from '../../src/store/tracking';

describe('TrackingStore', () => {
  beforeEach(() => {
    useTrackingStore.setState({ items: [] });
  });

  it('debe agregar un item correctamente', () => {
    useTrackingStore.getState().addItem({
      externalId: 1,
      mediaType: 'movie',
      title: 'Test Movie',
      status: 'watching',
    });

    const state = useTrackingStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].title).toBe('Test Movie');
    expect(state.items[0].mediaType).toBe('movie');
  });

  it('debe remover un item por id', () => {
    useTrackingStore.getState().addItem({
      externalId: 1,
      mediaType: 'movie',
      title: 'Test Movie',
      status: 'watching',
    });

    const itemId = useTrackingStore.getState().items[0].id;
    useTrackingStore.getState().removeItem(itemId);

    expect(useTrackingStore.getState().items).toHaveLength(0);
  });

  it('debe actualizar un item', () => {
    useTrackingStore.getState().addItem({
      externalId: 1,
      mediaType: 'movie',
      title: 'Test Movie',
      status: 'watching',
    });

    const itemId = useTrackingStore.getState().items[0].id;
    useTrackingStore.getState().updateItem(itemId, {
      status: 'completed',
      rating: 9,
    });

    const updatedItem = useTrackingStore.getState().items[0];
    expect(updatedItem.status).toBe('completed');
    expect(updatedItem.rating).toBe(9);
  });

  it('debe filtrar items por tipo', () => {
    useTrackingStore.getState().addItem({
      externalId: 1,
      mediaType: 'movie',
      title: 'Test Movie',
      status: 'watching',
    });

    useTrackingStore.getState().addItem({
      externalId: 2,
      mediaType: 'tv',
      title: 'Test TV',
      status: 'watching',
    });

    const movies = useTrackingStore.getState().getItemsByType('movie');
    const tvShows = useTrackingStore.getState().getItemsByType('tv');

    expect(movies).toHaveLength(1);
    expect(movies[0].mediaType).toBe('movie');
    expect(tvShows).toHaveLength(1);
    expect(tvShows[0].mediaType).toBe('tv');
  });

  it('debe limpiar todos los items', () => {
    useTrackingStore.getState().addItem({
      externalId: 1,
      mediaType: 'movie',
      title: 'Test Movie',
      status: 'watching',
    });

    useTrackingStore.getState().clearAll();

    expect(useTrackingStore.getState().items).toHaveLength(0);
  });
});
