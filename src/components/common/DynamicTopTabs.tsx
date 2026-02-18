import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

type DynamicTopTabsProps = BottomTabBarProps & {
  isDark: boolean;
  pendingRequests: number;
  activeColor: string;
};

export default function DynamicTopTabs(_props: DynamicTopTabsProps) {
  return null;
}
