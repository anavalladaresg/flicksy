# 🎬 Flicksy - Media Tracker App

Una aplicación React Native moderna para hacer seguimiento de películas, series y videojuegos con integración de APIs reales (TMDb e IGDB).

## ✨ Características

- 🎥 **Descubrimiento de Contenido**: Películas, series y juegos populares
- 🔍 **Búsqueda Global**: Busca simultáneamente en todas las categorías
- 📚 **Biblioteca Personal**: Guarda lo que estás viendo/jugando
- 📱 **UI Moderna**: Interfaz responsive con React Native + Expo
- 🏗️ **Arquitectura Limpia**: Domain/Data/Presentation pattern
- � **TypeScript Total**: Tipado estricto en toda la app
- ⚡ **React Query**: Caching y sincronización automática
- 🧠 **Zustand**: Estado global ligero
- 🧪 **Tests**: Unit tests incluidos

## 🚀 Quick Start

### 1. Instalar
```bash
npm install --legacy-peer-deps
```

### 2. Configurar
```bash
cp .env.example .env.local
# Edita .env.local con tus claves de API
```

### 3. Ejecutar
```bash
npm start
# Escanea código QR con Expo Go
```

**[Guía detallada →](./QUICK_START.md)**

## 📚 Documentación

- **[QUICK_START.md](./QUICK_START.md)** - Empezar en 5 minutos
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Estructura y patrones
- **[API_INTEGRATION.md](./API_INTEGRATION.md)** - Integración de APIs
- **[USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)** - Ejemplos de código
- **[TYPESCRIPT_GUIDE.md](./TYPESCRIPT_GUIDE.md)** - Guía de tipos
- **[SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)** - Checklist de setup

## 🏗️ Arquitectura

```
src/
├── features/           # Feature modules (movies, tv, games, tracking)
├── services/           # HTTP clients, error handling
├── components/         # Componentes reutilizables
├── screens/            # Pantallas principales
├── navigation/         # React Navigation setup
├── store/              # Zustand stores
├── types/              # Tipos TypeScript
├── constants/          # Configuración
└── utils/              # Utilidades
```

## 🔌 Stack Tecnológico

- **Expo 54** - React Native framework
- **React Navigation 7** - Navegación
- **TypeScript 5.9** - Tipado estricto
- **@tanstack/react-query** - Data fetching y caching
- **Zustand** - Estado global
- **Axios** - Cliente HTTP
- **Jest** - Testing

## 🎯 Casos de Uso

### 1. Cargar películas populares
```typescript
const { data, isLoading } = usePopularMovies(1);
```

### 2. Buscar películas
```typescript
const { data } = useSearchMovies({ query: 'inception' }, enabled);
```

### 3. Agregar a biblioteca
```typescript
const { addItem } = useTrackingStore();
addItem({
  externalId: 550,
  mediaType: 'movie',
  title: 'Fight Club',
  status: 'watching'
});
```

**[Más ejemplos →](./USAGE_EXAMPLES.md)**

## 🧪 Testing

```bash
# Unit tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

## ⚙️ Comandos

```bash
npm start         # Iniciar app
npm run ios       # iOS
npm run android   # Android
npm run web       # Web
npm test          # Tests
npm run type-check # Verificar tipos
npm run lint      # Linter
npm run format    # Formatear código
```

## 🔑 Claves de API

### TMDb API
1. Ve a https://www.themoviedb.org/settings/api
2. Solicita una API key
3. Copia a `.env.local`:
```
EXPO_PUBLIC_TMDB_API_KEY=your_key
```

### IGDB API
1. Ve a https://api-docs.igdb.com/
2. Obtén Client ID y Access Token
3. Copia a `.env.local`:
```
EXPO_PUBLIC_IGDB_CLIENT_ID=your_client_id
EXPO_PUBLIC_IGDB_ACCESS_TOKEN=your_token
```

## 📱 Pantallas

- **Home** - Películas, series y juegos populares
- **Details** - Información completa de cada media
- **Search** - Búsqueda global
- **Library** - Tu biblioteca personal

## 🎨 Componentes Principales

- `MediaCard` - Tarjeta reutilizable
- `Skeleton` - Loaders
- `EmptyState` - Estado vacío
- `ErrorMessage` - Manejo de errores

## 📊 Estado Global

### Zustand Tracking Store
- `addItem()` - Agregar item
- `removeItem()` - Eliminar item
- `updateItem()` - Actualizar item
- `getItemsByType()` - Filtrar por tipo
- Persiste automáticamente en AsyncStorage

## 🔒 Error Handling

```typescript
import { getErrorMessage, logError } from '@/services';

try {
  const movies = await movieRepository.getPopularMovies();
} catch (error) {
  const message = getErrorMessage(error);
  logError(error, 'HomeScreen');
}
```

## 🚧 Próximas Mejoras

- [ ] E2E tests con Maestro/Detox
- [ ] Dark mode
- [ ] Recomendaciones personalizadas
- [ ] Integración social
- [ ] Notificaciones push

## 📄 Licencia

MIT

## 👨‍💻 Autor

Flicksy Team - 2026

---

**[Empezar →](./QUICK_START.md)** | **[Documentación](./ARCHITECTURE.md)** | **[Ejemplos](./USAGE_EXAMPLES.md)**

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
