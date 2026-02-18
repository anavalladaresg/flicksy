import React from 'react';
import { Toaster } from 'sileo';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Fonts } from '@/constants/theme';

export default function AppToaster() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const fontFamily = Fonts.web?.sans || "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  return (
    <Toaster
      richColors
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
          title: `font-family: ${fontFamily} !important; font-weight: 700 !important; font-size: 15px !important; ${isDark ? 'color: #E5E7EB !important;' : 'color: #0F172A !important;'}`,
          description: `font-family: ${fontFamily} !important; font-weight: 500 !important; font-size: 14px !important; ${isDark ? 'color: #CBD5E1 !important;' : 'color: #64748B !important;'}`,
          badge: isDark ? 'background-color: rgba(255, 255, 255, 0.1) !important;' : 'background-color: rgba(0, 0, 0, 0.05) !important;',
          button: `${isDark ? 'background-color: rgba(255, 255, 255, 0.1) !important; color: #E5E7EB !important;' : 'background-color: rgba(0, 0, 0, 0.05) !important; color: #0F172A !important;'} font-family: ${fontFamily} !important; font-weight: 600 !important;`,
        },
      }}
    />
  );
}

