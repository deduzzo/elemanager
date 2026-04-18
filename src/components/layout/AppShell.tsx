import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';

export function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
