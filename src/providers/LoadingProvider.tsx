import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import MagicParticlesLoader from '@/components/loaders/MagicParticlesLoader';

export type LoaderRequest = {
  text?: string;
  overlay?: boolean;
  fullScreen?: boolean;
  withinModal?: boolean;
  blur?: boolean;
  size?: number;
  particleCount?: number;
  speed?: number;
  hueRange?: [number, number];
  color?: string;
  secondaryColor?: string;
};

type LoadingContextValue = {
  isVisible: boolean;
  showLoader: (options?: LoaderRequest) => void;
  hideLoader: () => void;
};

const SHOW_DELAY_MS = 150;
const MIN_VISIBLE_MS = 300;

const defaultOptions: Required<Pick<LoaderRequest, 'overlay' | 'fullScreen' | 'blur'>> = {
  overlay: true,
  fullScreen: true,
  blur: true,
};

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const [options, setOptions] = useState<LoaderRequest>(defaultOptions);

  const activeRequestsRef = useRef(0);
  const visibleSinceRef = useRef<number | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const showLoader = useCallback(
    (nextOptions?: LoaderRequest) => {
      activeRequestsRef.current += 1;
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      setOptions((prev) => ({
        ...prev,
        ...defaultOptions,
        ...nextOptions,
      }));

      if (isVisible) return;
      if (showTimerRef.current) return;

      showTimerRef.current = setTimeout(() => {
        showTimerRef.current = null;
        if (activeRequestsRef.current <= 0) return;
        visibleSinceRef.current = Date.now();
        setIsVisible(true);
      }, SHOW_DELAY_MS);
    },
    [isVisible]
  );

  const hideLoader = useCallback(() => {
    activeRequestsRef.current = Math.max(0, activeRequestsRef.current - 1);
    if (activeRequestsRef.current > 0) return;

    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    if (!isVisible) return;

    const elapsed = visibleSinceRef.current ? Date.now() - visibleSinceRef.current : MIN_VISIBLE_MS;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);

    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      if (activeRequestsRef.current > 0) return;
      visibleSinceRef.current = null;
      setIsVisible(false);
    }, wait);
  }, [isVisible]);

  React.useEffect(() => clearTimers, [clearTimers]);

  const value = useMemo(
    () => ({
      isVisible,
      showLoader,
      hideLoader,
    }),
    [hideLoader, isVisible, showLoader]
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <MagicParticlesLoader
        visible={isVisible}
        overlay={options.overlay ?? true}
        fullScreen={options.withinModal ? false : (options.fullScreen ?? true)}
        withinModal={options.withinModal ?? false}
        blur={options.blur ?? true}
        text={options.text}
        size={options.size}
        particleCount={options.particleCount}
        speed={options.speed}
        hueRange={options.hueRange}
        color={options.color}
        secondaryColor={options.secondaryColor}
      />
    </LoadingContext.Provider>
  );
}

export function useLoadingContext() {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useGlobalLoader must be used inside LoadingProvider');
  return ctx;
}
