import { useEffect, useRef, useState } from 'react';
import { useRoute } from './router.js';
import { useAppData } from './app-data.js';
import { LeftNav } from './components/LeftNav.js';
import { TopHeader } from './components/TopHeader.js';
import { MobileChrome } from './components/MobileChrome.js';
import { RightActionPanel } from './components/RightActionPanel.js';
import { SituationModal } from './components/SituationModal.js';
import { MagazinePage } from './pages/MagazinePage.js';
import { MeaningDetailPage } from './pages/MeaningDetailPage.js';
import { RadarPage } from './pages/RadarPage.js';

export function App(): JSX.Element {
  const route = useRoute();
  const { toast } = useAppData();
  const [editingSituation, setEditingSituation] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const routeKey = route.name === 'meaning' ? `meaning:${route.id}` : route.name;

  // Desktop main is its own scroll container and persists across
  // routes, so navigating must reset its offset (mobile uses window).
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [routeKey]);

  return (
    <div className="app">
      <LeftNav />
      <TopHeader onEditSituation={() => setEditingSituation(true)} />
      <MobileChrome onEditSituation={() => setEditingSituation(true)} />

      <main className="main" ref={mainRef}>
        {route.name === 'home' && <MagazinePage />}
        {route.name === 'meaning' && <MeaningDetailPage id={route.id} />}
        {route.name === 'radar' && <RadarPage />}
      </main>

      <aside className="aside" aria-label="求职行动面板">
        <RightActionPanel onEditSituation={() => setEditingSituation(true)} />
      </aside>

      {editingSituation && <SituationModal onClose={() => setEditingSituation(false)} />}
      {toast !== null && <div className="toast">{toast}</div>}
    </div>
  );
}
