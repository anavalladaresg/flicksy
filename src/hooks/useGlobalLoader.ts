import { useLoadingContext } from '@/src/providers/LoadingProvider';

export function useGlobalLoader() {
  const { isVisible, showLoader, hideLoader } = useLoadingContext();
  return { isVisible, showLoader, hideLoader };
}

export default useGlobalLoader;
