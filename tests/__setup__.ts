/**
 * Configuración de Jest
 * Setup inicial para tests
 */

import '@testing-library/jest-native/extend-expect';

// Mock de AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Suprimir warnings innecesarios
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = jest.fn((...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Non-serializable values were found in the navigation state')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  });
});

afterAll(() => {
  console.warn = originalWarn;
});
