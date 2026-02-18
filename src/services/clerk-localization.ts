import { esES } from '@clerk/localizations';

export const clerkEsLocalization = {
  ...esES,
  dividerText: 'o continua con',
  formFieldLabel__emailAddress: 'Tu email',
  formFieldLabel__password: 'Tu contrasena',
  formFieldLabel__firstName: 'Nombre',
  formFieldLabel__lastName: 'Apellido',
  formFieldHintText__optional: 'Opcional',
  signIn: {
    ...esES.signIn,
    start: {
      ...esES.signIn.start,
      title: 'Bienvenido de vuelta',
      titleCombined: 'Bienvenido de vuelta',
      subtitle: 'Entra para seguir descubriendo y guardando tus favoritos en Flicksy.',
      subtitleCombined: 'Entra para seguir descubriendo y guardando tus favoritos en Flicksy.',
      actionText: 'Primera vez por aqui?',
      actionLink: 'Crear cuenta gratis',
      actionLink__use_email: 'Continuar con email',
    },
  },
  signUp: {
    ...esES.signUp,
    start: {
      ...esES.signUp.start,
      title: 'Crea tu cuenta en segundos',
      titleCombined: 'Crea tu cuenta en segundos',
      subtitle: 'Empieza a construir tu coleccion de pelis, series y juegos favoritos.',
      subtitleCombined: 'Empieza a construir tu coleccion de pelis, series y juegos favoritos.',
      actionText: 'Ya tienes cuenta?',
      actionLink: 'Entrar',
      actionLink__use_email: 'Registrarte con email',
    },
  },
  socialButtonsBlockButton: 'Continuar con {{provider|titleize}}',
} as const;
