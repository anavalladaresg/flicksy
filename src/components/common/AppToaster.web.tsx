import React, { useEffect } from 'react';
import { SILEO_POSITIONS, Toaster, sileo, type SileoPosition } from 'sileo';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Fonts } from '@/constants/theme';

export default function AppToaster() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const fontFamily = Fonts.web?.sans || "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  useEffect(() => {
    const onToastClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-sileo-button]')) return;
      const toast = target.closest('[data-sileo-toast]') as HTMLElement | null;
      if (!toast) return;

      const viewport = toast.closest('[data-sileo-viewport]') as HTMLElement | null;
      const positionAttr = viewport?.getAttribute('data-position') || undefined;
      if (positionAttr && SILEO_POSITIONS.includes(positionAttr as SileoPosition)) {
        sileo.clear(positionAttr as SileoPosition);
      } else {
        sileo.clear();
      }
    };

    document.addEventListener('click', onToastClick, true);
    return () => document.removeEventListener('click', onToastClick, true);
  }, []);

  return (
    <Toaster
      richColors={false}
      position="top-right"
      closeButton
      options={{
        fill: isDark ? '#111827' : '#FFFFFF',
        roundness: 16,
        autopilot: {
          expand: 500,
          collapse: 3000,
        },
        styles: {
          title: `font-family: ${fontFamily} !important; font-weight: 700 !important; font-size: 15px !important; line-height: 1.2 !important; ${isDark ? 'color: #F8FAFC !important; -webkit-text-fill-color: #F8FAFC !important;' : 'color: #0F172A !important;'}`,
          description: `font-family: ${fontFamily} !important; font-weight: 500 !important; font-size: 14px !important; line-height: 1.35 !important; ${isDark ? 'color: #E2E8F0 !important; -webkit-text-fill-color: #E2E8F0 !important; opacity: 1 !important;' : 'color: #64748B !important;'}`,
          badge: `${isDark ? 'background-color: rgba(125, 211, 252, 0.2) !important;' : 'background-color: rgba(14, 116, 144, 0.12) !important;'} width: 22px !important; height: 22px !important; min-width: 22px !important; min-height: 22px !important; border-radius: 999px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; line-height: 1 !important; padding: 0 !important;`,
          button: `${isDark ? 'background-color: rgba(255, 255, 255, 0.1) !important; color: #E5E7EB !important;' : 'background-color: rgba(0, 0, 0, 0.05) !important; color: #0F172A !important;'} font-family: ${fontFamily} !important; font-weight: 600 !important;`,
          container: `${isDark ? 'background-color: #111827 !important; border: 1px solid #334155 !important;' : 'background-color: #FFFFFF !important; border: 1px solid #E2E8F0 !important;'}`,
        },
      }}
    />
  );
}
