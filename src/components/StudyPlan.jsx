import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { loadStudyData, saveStudyData, id } from '../lib/studyStorage.js';
import { getPublicLibraryItems } from '../lib/publicLibrary.js';
import { computeBurnoutFromContext } from '../lib/burnoutMeter.js';
import '../css/StudyPlan.css';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBREV = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
function normalizeDay(day) {
  if (!day) return '';
  const d = day.trim();
  return DAY_ABBREV[d] || (DAY_ORDER.includes(d) ? d : d);
}

function getWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  return DAY_ORDER.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { day: DAY_ORDER[i], date: d };
  });
}

function formatDateLong(d, dayName) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNum = d.getDate();
  const suffix = dayNum === 1 || dayNum === 21 || dayNum === 31 ? 'st' : dayNum === 2 || dayNum === 22 ? 'nd' : dayNum === 3 || dayNum === 23 ? 'rd' : 'th';
  return `${dayName}, ${months[d.getMonth()]} ${dayNum}${suffix}, ${d.getFullYear()}`;
}

function formatDateFromISO(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return { date: null, dayName: '', formatted: '' };
  const d = new Date(dateStr + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return { date: null, dayName: '', formatted: '' };
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[d.getDay()];
  return { date: d, dayName, formatted: formatDateLong(d, dayName) };
}

function parseActivity(activity) {
  if (!activity) return { subject: 'Study', duration: '' };
  const match = activity.match(/^(.+?)\s*[•·\-]\s*(\d+)\s*min\)?$|^(.+?)\s*\((\d+)\s*min\)$/);
  if (match) {
    const subject = (match[1] || match[3] || activity).trim();
    const duration = match[2] || match[4] || '';
    return { subject, duration: duration ? `${duration} min` : '' };
  }
  const paren = activity.match(/^(.+?)\s*\((\d+)\s*min\)$/);
  if (paren) return { subject: paren[1].trim(), duration: `${paren[2]} min` };
  return { subject: activity, duration: '' };
}

function tipToCard(tip, index) {
  if (typeof tip === 'object' && tip !== null && (tip.title || tip.description)) {
    return { title: tip.title || 'Tip', description: tip.description || '' };
  }
  const str = typeof tip === 'string' ? tip : String(tip);
  const dot = str.indexOf('.');
  if (dot > 0 && dot < 40) {
    return { title: str.slice(0, dot).trim(), description: str.slice(dot + 1).trim() };
  }
  const words = str.split(/\s+/);
  if (words.length <= 4) return { title: str, description: '' };
  return { title: words.slice(0, 3).join(' '), description: words.slice(3).join(' ') };
}

export default function StudyPlan({ plan, onBack, error, saveError, librarySearch = '', onViewPublicItem, onAddToFolder }) {
  if (!plan) return null;

  const {
    summary,
    technique,
    techniqueDescription,
    studyBlocks,
    tips,
    weeklyTimeline,
    burnoutMeter,
    burnoutExplanation,
  } = plan;

  const burnout = useMemo(() => {
    if (burnoutMeter && burnoutExplanation) {
      return { ...burnoutMeter, explanation: burnoutExplanation };
    }
    return computeBurnoutFromContext(null, plan);
  }, [plan, burnoutMeter, burnoutExplanation]);

  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const [publicItems, setPublicItems] = useState([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState(null);
  const [importFolders, setImportFolders] = useState([]);
  const [importItemsByFolder, setImportItemsByFolder] = useState({});
  const [selectedImportFolderId, setSelectedImportFolderId] = useState('');

  const { user } = useAuth();
  const userId = user?.id || null;

  useEffect(() => {
    const data = loadStudyData(userId);
    setImportFolders(data.folders || []);
    setImportItemsByFolder(data.itemsByFolder || {});
    setSelectedImportFolderId((prev) => prev || data.folders?.[0]?.id || '');
  }, [userId]);

  useEffect(() => {
    let canceled = false;
    setPublicLoading(true);
    setPublicError(null);
    getPublicLibraryItems(librarySearch)
      .then((items) => { if (!canceled) setPublicItems(items); })
      .catch((err) => { if (!canceled) setPublicError(err?.message || 'Could not load public library.'); })
      .finally(() => { if (!canceled) setPublicLoading(false); });
    return () => { canceled = true; };
  }, [librarySearch]);

  function persistStudyData(nextFolders, nextItems) {
    setImportFolders(nextFolders);
    setImportItemsByFolder(nextItems);
    saveStudyData(userId, { folders: nextFolders, itemsByFolder: nextItems });
  }

  function ensureTargetFolder() {
    let folders = [...importFolders];
    let itemsByFolder = { ...importItemsByFolder };
    let folderId = selectedImportFolderId;
    if (!folderId || !folders.some((f) => f.id === folderId)) {
      const newFolder = { id: id(), name: 'Library imports', description: 'Items imported from the Public Library' };
      folders = [...folders, newFolder];
      itemsByFolder[newFolder.id] = itemsByFolder[newFolder.id] || [];
      folderId = newFolder.id;
      setSelectedImportFolderId(newFolder.id);
    }
    return { folders, itemsByFolder, folderId };
  }

  function addPublicItemToFolder(publicItem) {
    const baseData = publicItem.data || {};
    const { folders, itemsByFolder, folderId } = ensureTargetFolder();
    const list = itemsByFolder[folderId] || [];
    let type = publicItem.type;
    if (type !== 'flashcards' && type !== 'study_guide' && type !== 'practice_test') type = 'study_guide';
    let localData;
    if (type === 'flashcards') localData = { cards: Array.isArray(baseData.cards) ? baseData.cards : [] };
    else if (type === 'practice_test') localData = { questions: Array.isArray(baseData.questions) ? baseData.questions : [] };
    else localData = { sections: Array.isArray(baseData.sections) ? baseData.sections : [] };
    const rawTitle = (publicItem.title || 'Imported set');
    const title = rawTitle.length <= 50 ? rawTitle : rawTitle.slice(0, 50);
    const nextItemsByFolder = { ...itemsByFolder, [folderId]: [...list, { id: id(), type, title, data: localData }] };
    persistStudyData(folders, nextItemsByFolder);
  }

  const tipCards = Array.isArray(tips) ? tips.slice(0, 4) : [];
  while (tipCards.length < 4) tipCards.push('Stay consistent and take breaks.');
  const tipCardsWithMeta = tipCards.map((t, i) => tipToCard(t, i));

  const isTestPlan = plan.planType === 'test';
  const hasDateEntries = (weeklyTimeline || []).some((e) => e.date);
  const useDateTimeline = isTestPlan && hasDateEntries;

  const weekDates = getWeekDates();
  const timelineByDay = (weeklyTimeline || []).reduce((acc, entry) => {
    const day = normalizeDay(entry.day || '');
    if (!day) return acc;
    if (!acc[day]) acc[day] = [];
    acc[day].push(entry);
    return acc;
  }, {});

  const timelineByDate = useDateTimeline
    ? (weeklyTimeline || []).reduce((acc, entry) => {
        const dateStr = entry.date && String(entry.date).trim();
        if (!dateStr) return acc;
        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(entry);
        return acc;
      }, {})
    : {};
  const sortedTimelineDates = useDateTimeline
    ? [...new Set((weeklyTimeline || []).map((e) => e.date).filter(Boolean))].sort()
    : [];

  const hasExtraTimelineDays = useDateTimeline && sortedTimelineDates.length > 7;
  const visibleTimelineDates = useDateTimeline && hasExtraTimelineDays && !showFullTimeline
    ? sortedTimelineDates.slice(0, 7)
    : sortedTimelineDates;

  const blocksByDay = (weeklyTimeline || []).reduce((acc, entry, idx) => {
    const day = normalizeDay(entry.day || '') || DAY_ORDER[idx % 7];
    if (!acc[day]) acc[day] = [];
    const { subject, duration } = parseActivity(entry.activity);
    acc[day].push({
      time: entry.time,
      subject,
      duration: duration || '45 min',
      sessionType: idx % 2 === 0 ? 'Deep study session' : 'Review & practice',
      priority: idx === 0 ? 'high' : 'medium',
    });
    return acc;
  }, {});

  // No separate study-blocks-by-date section any more (removed per design).

  return (
    <div className="study-plan">
      {saveError && (
        <div className="plan-error" role="alert">
          {saveError} If this keeps happening, create the <strong>study_plans</strong> table in your Supabase project (see README or <code>supabase/migrations/001_study_plans.sql</code>).
        </div>
      )}
      {error && (
        <div className="plan-info" role="status">
          This plan was built from your answers. You can create a new plan anytime from <strong>My plan</strong>.
        </div>
      )}

      <div className="plan-header">
        <h1 className="plan-technique-title">{technique || 'Your tailored plan'}</h1>
        <p className="plan-technique-description">
          {techniqueDescription || summary}
        </p>
      </div>

      <section className="plan-section plan-section-burnout" aria-label="Burnout">
        <h2 className="plan-section-heading">Burnout</h2>
        <div className="plan-burnout">
          <h3 className="plan-burnout-title">Burnout risk</h3>
          <div className="plan-burnout-meter">
            <div
              className="plan-burnout-bar"
              style={{ width: `${Math.min(100, Math.max(0, burnout.score))}%` }}
              data-level={burnout.label}
            />
          </div>
          <p className="plan-burnout-label">
            <span className="plan-burnout-label-value">{burnout.label}</span>
            <span className="plan-burnout-label-score">({burnout.score}/100)</span>
          </p>
          <p className="plan-burnout-why">{burnout.explanation}</p>
          <div className="plan-burnout-tips">
            <h4 className="plan-burnout-tips-title">Burnout tips</h4>
            <ul className="plan-burnout-tips-list">
              <li>Schedule short breaks between blocks — your brain needs recovery time.</li>
              <li>Protect sleep; cut back on sessions before bed if you’re already tired.</li>
              <li>If the plan feels too heavy, do less and repeat — consistency beats cramming.</li>
              <li>Say no to extra commitments when you’re close to a deadline or low on energy.</li>
              <li>Notice when you’re pushing through exhaustion and pause instead of powering on.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="plan-section plan-section-tips">
        <h2 className="plan-section-heading">
          Studying tips
        </h2>
        <div className="tips-grid">
          {tipCardsWithMeta.map((tip, i) => (
            <div key={i} className="tip-card">
              <h3 className="tip-card-title">{tip.title}</h3>
              {tip.description && <p className="tip-card-desc">{tip.description}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="plan-section plan-section-week">
        <h2 className="plan-section-heading">
          {useDateTimeline ? 'Your study timeline' : 'Your Week at a Glance'}
        </h2>
        <div className="timeline-track">
          <div className="timeline-line" aria-hidden />
          {useDateTimeline
            ? visibleTimelineDates.map((dateStr, index) => {
                const entries = timelineByDate[dateStr] || [];
                const { formatted } = formatDateFromISO(dateStr);
                const isLeft = index % 2 === 0;
                const cardContent = (
                  <div className="timeline-card">
                    <span className="timeline-card-date">{formatted}</span>
                    <span className={`timeline-card-tag ${entries.length > 0 ? 'timeline-card-tag--study' : 'timeline-card-tag--rest'}`}>
                      {entries.length > 0 ? 'STUDY' : 'REST'}
                    </span>
                    <p className="timeline-card-desc">
                      {(() => {
                        const studyEntries = entries
                          .map((e) => {
                            const { subject, duration } = parseActivity(e.activity);
                            if (!duration) return null;
                            const base = subject || 'Study session';
                            return `${base} at ${e.time} (${duration})`;
                          })
                          .filter(Boolean);
                        return studyEntries.length > 0
                          ? studyEntries.join(' · ')
                          : 'No scheduled activities';
                      })()}
                    </p>
                  </div>
                );
                return (
                  <div key={dateStr} className="timeline-item">
                    <div className={`timeline-item-content timeline-item-content--${isLeft ? 'left' : 'right'}`}>
                      {isLeft ? cardContent : null}
                    </div>
                    <div className="timeline-item-node" aria-hidden />
                    <div className={`timeline-item-content timeline-item-content--${isLeft ? 'right' : 'left'}`}>
                      {isLeft ? null : cardContent}
                    </div>
                  </div>
                );
              })
            : weekDates.map(({ day, date }, index) => {
                const entries = timelineByDay[day] || [];
                const isLeft = index % 2 === 0;
                const cardContent = (
                  <div className="timeline-card">
                    <span className="timeline-card-date">{formatDateLong(date, day)}</span>
                    <span className={`timeline-card-tag ${entries.length > 0 ? 'timeline-card-tag--study' : 'timeline-card-tag--rest'}`}>
                      {entries.length > 0 ? 'STUDY' : 'REST'}
                    </span>
                    <p className="timeline-card-desc">
                      {(() => {
                        const studyEntries = entries
                          .map((e) => {
                            const { subject, duration } = parseActivity(e.activity);
                            if (!duration) return null;
                            const base = subject || 'Study session';
                            return `${base} at ${e.time} (${duration})`;
                          })
                          .filter(Boolean);
                        return studyEntries.length > 0
                          ? studyEntries.join(' · ')
                          : 'No scheduled activities';
                      })()}
                    </p>
                  </div>
                );
                return (
                  <div key={day} className="timeline-item">
                    <div className={`timeline-item-content timeline-item-content--${isLeft ? 'left' : 'right'}`}>
                      {isLeft ? cardContent : null}
                    </div>
                    <div className="timeline-item-node" aria-hidden />
                    <div className={`timeline-item-content timeline-item-content--${isLeft ? 'right' : 'left'}`}>
                      {isLeft ? null : cardContent}
                    </div>
                  </div>
                );
              })}
        </div>
        {useDateTimeline && hasExtraTimelineDays && (
          <button
            type="button"
            className="timeline-toggle-button"
            onClick={() => setShowFullTimeline((prev) => !prev)}
          >
            {showFullTimeline ? 'Show first 7 days' : `Show all ${sortedTimelineDates.length} days`}
          </button>
        )}
      </section>

      <section className="plan-section plan-section-public-library">
        <h2 className="plan-section-heading">Public Library</h2>
        <p className="plan-public-description">Browse flashcards, study guides, and practice tests shared by others. Add any item to your own folder.</p>
        <div className="plan-public-controls">
          <span className="plan-public-search-hint">Search: {(librarySearch || '').trim() || 'all'}</span>
          <div className="plan-public-folder-select">
            <label htmlFor="public-import-folder">Save to folder</label>
            <select id="public-import-folder" value={selectedImportFolderId} onChange={(e) => setSelectedImportFolderId(e.target.value)}>
              {importFolders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              {importFolders.length === 0 && <option value="">(Will create &quot;Library imports&quot;)</option>}
            </select>
          </div>
        </div>
        {publicError && <p className="plan-public-error" role="alert">{publicError}</p>}
        {publicLoading && <p className="plan-public-loading">Loading…</p>}
        {!publicLoading && !publicError && publicItems.length === 0 && <p className="plan-public-empty">No public items found.</p>}
        {!publicLoading && !publicError && publicItems.length > 0 && (
          <ul className="plan-public-grid">
            {publicItems.map((item) => (
              <li key={item.id} className="plan-public-card">
                <div className="plan-public-type">{item.type === 'flashcards' ? 'Flashcards' : item.type === 'practice_test' ? 'Practice test' : 'Study guide'}</div>
                <h3 className="plan-public-title">{item.title}</h3>
                {item.description && <p className="plan-public-desc">{item.description}</p>}
                <p className="plan-public-by">by {item.creatorUsername || 'Anonymous'}</p>
                <div className="plan-public-card-actions">
                  <button type="button" className="plan-public-btn" onClick={() => onViewPublicItem?.(item)}>View</button>
                  <button type="button" className="plan-public-btn" onClick={() => (onAddToFolder ? onAddToFolder(item) : addPublicItemToFolder(item))}>Add to folder</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="plan-footer">
        <button type="button" className="btn-back" onClick={onBack}>
          Create New Plan
        </button>
      </div>
    </div>
  );
}
