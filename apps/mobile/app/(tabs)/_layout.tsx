import { Tabs } from 'expo-router'
import { id } from '@/lib/i18n'

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: id.tabs.home }} />
      <Tabs.Screen name="orders" options={{ title: id.tabs.orders }} />
      <Tabs.Screen name="profile" options={{ title: id.tabs.profile }} />
    </Tabs>
  )
}
