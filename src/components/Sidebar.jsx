import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { loadStudyData } from '../lib/studyStorage.js';
import { getRecentlyOpened } from '../lib/recentStorage.js';
import { getAllStudyPlans, getWeekOfMondayLabel } from '../lib/studyPlans.js';
import '../css/Sidebar.css';

export default function Sidebar({
  onGoToStudy,
  onGoToFolder,
  onGoToPlan,
  onGoToPlanList,
  onGoToRecent,
}) {
  const { user, isLoggedIn } = useAuth();
  const userId = user?.id || null;

  const { folders } = loadStudyData(userId);
  const recent = getRecentlyOpened(userId);

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      setPlans([]);
      return;
    }
    setPlansLoading(true);
    getAllStudyPlans()
      .then((rows) => {
        const withContent = (rows || []).filter((row) => {
          const p = row?.plan;
          if (!p) return false;
          return (
            (p.technique && p.technique.trim()) ||
            (p.considerations && p.considerations.length > 0) ||
            (p.weeklyTimeline && p.weeklyTimeline.length > 0) ||
            (p.studyBlocks && p.studyBlocks.length > 0)
          );
        });
        setPlans(withContent);
      })
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, [isLoggedIn]);

  const SIDEBAR_MAX = 3;
  const foldersShow = folders.slice(0, SIDEBAR_MAX);
  const recentShow = recent.slice(0, SIDEBAR_MAX);
  const plansShow = plans.slice(0, SIDEBAR_MAX);

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <section className="sidebar-section">
          <h3 className="sidebar-heading">My folders</h3>
          {folders.length === 0 ? (
            <p className="sidebar-empty">No folders yet</p>
          ) : (
            <ul className="sidebar-list">
              {foldersShow.map((folder) => (
                <li key={folder.id}>
                  <button
                    type="button"
                    className="sidebar-link"
                    onClick={() => onGoToFolder(folder)}
                  >
                    {folder.name}
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="sidebar-link sidebar-link--show-all" onClick={onGoToStudy}>
                  Show all folders
                </button>
              </li>
            </ul>
          )}
        </section>

        <section className="sidebar-section">
          <h3 className="sidebar-heading">Recently opened</h3>
          {recent.length === 0 ? (
            <p className="sidebar-empty">Nothing opened yet</p>
          ) : (
            <ul className="sidebar-list">
              {recentShow.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <button
                    type="button"
                    className="sidebar-link"
                    onClick={() => onGoToRecent(item)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="sidebar-link sidebar-link--show-all" onClick={onGoToStudy}>
                  Show all recent
                </button>
              </li>
            </ul>
          )}
        </section>

        <section className="sidebar-section">
          <h3 className="sidebar-heading">My plans</h3>
          {!isLoggedIn ? (
            <p className="sidebar-empty">Log in to see plans</p>
          ) : plansLoading ? (
            <p className="sidebar-empty">Loading…</p>
          ) : plans.length === 0 ? (
            <p className="sidebar-empty">No plans yet</p>
          ) : (
            <ul className="sidebar-list">
              {plansShow.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="sidebar-link"
                    onClick={() => onGoToPlan(row)}
                  >
                    {getWeekOfMondayLabel(row.created_at)}
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="sidebar-link sidebar-link--show-all" onClick={onGoToPlanList}>
                  Show all plans
                </button>
              </li>
            </ul>
          )}
        </section>
      </nav>
    </aside>
  );
}
