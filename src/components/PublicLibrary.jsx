import { useEffect, useState, useRef } from 'react';
import { getPublicLibraryItems, getPublicLibraryItem } from '../lib/publicLibrary.js';
import PublicItemViewer from './PublicItemViewer.jsx';
import '../css/StudyPlan.css';
import '../css/Study.css';

export default function PublicLibrary({
  query,
  libraryItemId,
  onNavigateToItem,
  onBackToList,
  onAddToFolder,
  onOpenSignUp,
  isLoggedIn,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [singleItem, setSingleItem] = useState(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState(null);
  const flashRef = useRef(null);
  const guideRef = useRef(null);
  const testRef = useRef(null);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError(null);
    getPublicLibraryItems(query)
      .then((data) => { if (!canceled) setItems(data); })
      .catch((err) => { if (!canceled) setError(err?.message || 'Could not load public library.'); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [query]);

  useEffect(() => {
    if (!libraryItemId) {
      setSingleItem(null);
      setSingleError(null);
      return;
    }
    let canceled = false;
    setSingleLoading(true);
    setSingleError(null);
    getPublicLibraryItem(libraryItemId)
      .then((data) => { if (!canceled) setSingleItem(data); })
      .catch((err) => { if (!canceled) setSingleError(err?.message || 'Could not load item.'); })
      .finally(() => { if (!canceled) setSingleLoading(false); });
    return () => { canceled = true; };
  }, [libraryItemId]);

  function scrollRow(ref, direction) {
    const el = ref.current;
    if (!el) return;
    const amount = el.clientWidth || 0;
    el.scrollBy({ left: direction * amount, behavior: 'smooth' });
  }

  // Full-page single item view at /library/:id
  if (libraryItemId) {
    if (singleLoading) {
      return (
        <div className="library-single-wrap">
          <p className="plan-public-loading">Loading…</p>
        </div>
      );
    }
    if (singleError || !singleItem) {
      return (
        <div className="library-single-wrap">
          <p className="plan-public-error" role="alert">{singleError || 'Item not found.'}</p>
          <button type="button" className="plan-public-back-btn" onClick={onBackToList}>← Back to library</button>
        </div>
      );
    }
    return (
      <div className="library-single-wrap">
        <div className="library-single-toolbar">
          <button type="button" className="plan-public-back-btn" onClick={onBackToList}>← Back to library</button>
          {isLoggedIn ? (
            <button type="button" className="library-add-to-folder-btn" onClick={() => onAddToFolder?.(singleItem)}>Add to folder</button>
          ) : (
            <button type="button" className="library-add-to-folder-btn" onClick={onOpenSignUp}>Sign in to add to folder</button>
          )}
        </div>
        <div className="library-single-viewer">
          <PublicItemViewer item={singleItem} onClose={onBackToList} />
        </div>
      </div>
    );
  }

  const flashcards = items.filter((i) => i.type === 'flashcards');
  const guides = items.filter((i) => i.type === 'study_guide');
  const tests = items.filter((i) => i.type === 'practice_test');

  return (
    <div className="study-plan">
      <div className="plan-header">
        <h1 className="plan-technique-title">Public Library</h1>
        <p className="plan-technique-description">
          Browse public flashcards, study guides, and practice tests shared by other students.
        </p>
        <p className="plan-summary">
          Showing results for: <strong>{(query || '').trim() || 'all topics'}</strong>
        </p>
      </div>

      <section className="plan-section plan-section-public-library">
        {error && <p className="plan-public-error" role="alert">{error}</p>}
        {loading && <p className="plan-public-loading">Loading…</p>}
        {!loading && !error && items.length === 0 && (
          <p className="plan-public-empty">No public items found. Try a different search.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            {flashcards.length > 0 && (
              <div className="plan-public-group">
                <h2 className="plan-section-heading">Flashcards</h2>
                <div className="plan-public-row">
                  <button
                    type="button"
                    className="plan-public-scroll-btn"
                    onClick={() => scrollRow(flashRef, -1)}
                    aria-label="Scroll left"
                    disabled={flashcards.length <= 3}
                  >
                    ‹
                  </button>
                  <ul className="plan-public-grid" ref={flashRef}>
                  {flashcards.map((item) => (
                    <li key={item.id} className="plan-public-card">
                      <div
                        className="plan-public-card-main plan-public-card--clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => onNavigateToItem?.(item.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateToItem?.(item.id); } }}
                      >
                        <div className="plan-public-type">Flashcards</div>
                        <h3 className="plan-public-title">{item.title}</h3>
                        {item.description && <p className="plan-public-desc">{item.description}</p>}
                        <p className="plan-public-by">by {item.creatorUsername || 'Anonymous'}</p>
                        <span className="plan-public-view-hint">View</span>
                      </div>
                      <div className="plan-public-card-actions">
                        <button type="button" className="plan-public-btn" onClick={(e) => { e.stopPropagation(); isLoggedIn ? onAddToFolder?.(item) : onOpenSignUp?.(); }} title={isLoggedIn ? 'Add to your folder' : 'Sign in to add'}>{isLoggedIn ? 'Add to folder' : 'Sign in to add'}</button>
                      </div>
                    </li>
                  ))}
                  </ul>
                  <button
                    type="button"
                    className="plan-public-scroll-btn"
                    onClick={() => scrollRow(flashRef, 1)}
                    aria-label="Scroll right"
                    disabled={flashcards.length <= 3}
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
            {guides.length > 0 && (
              <div className="plan-public-group">
                <h2 className="plan-section-heading">Study guides</h2>
                <div className="plan-public-row">
                  <button
                    type="button"
                    className="plan-public-scroll-btn"
                    onClick={() => scrollRow(guideRef, -1)}
                    aria-label="Scroll left"
                    disabled={guides.length <= 3}
                  >
                    ‹
                  </button>
                  <ul className="plan-public-grid" ref={guideRef}>
                  {guides.map((item) => (
                    <li key={item.id} className="plan-public-card">
                      <div
                        className="plan-public-card-main plan-public-card--clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => onNavigateToItem?.(item.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateToItem?.(item.id); } }}
                      >
                        <div className="plan-public-type">Study guide</div>
                        <h3 className="plan-public-title">{item.title}</h3>
                        {item.description && <p className="plan-public-desc">{item.description}</p>}
                        <p className="plan-public-by">by {item.creatorUsername || 'Anonymous'}</p>
                        <span className="plan-public-view-hint">View</span>
                      </div>
                      <div className="plan-public-card-actions">
                        <button type="button" className="plan-public-btn" onClick={(e) => { e.stopPropagation(); isLoggedIn ? onAddToFolder?.(item) : onOpenSignUp?.(); }} title={isLoggedIn ? 'Add to your folder' : 'Sign in to add'}>{isLoggedIn ? 'Add to folder' : 'Sign in to add'}</button>
                      </div>
                    </li>
                  ))}
                  </ul>
                  <button
                    type="button"
                    className="plan-public-scroll-btn"
                    onClick={() => scrollRow(guideRef, 1)}
                    aria-label="Scroll right"
                    disabled={guides.length <= 3}
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
            {tests.length > 0 && (
              <div className="plan-public-group">
                <h2 className="plan-section-heading">Practice tests</h2>
                <div className="plan-public-row">
                  <button
                    type="button"
                    className="plan-public-scroll-btn"
                    onClick={() => scrollRow(testRef, -1)}
                    aria-label="Scroll left"
                    disabled={tests.length <= 3}
                  >
                    ‹
                  </button>
                  <ul className="plan-public-grid" ref={testRef}>
                  {tests.map((item) => (
                    <li key={item.id} className="plan-public-card">
                      <div
                        className="plan-public-card-main plan-public-card--clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => onNavigateToItem?.(item.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateToItem?.(item.id); } }}
                      >
                        <div className="plan-public-type">Practice test</div>
                        <h3 className="plan-public-title">{item.title}</h3>
                        {item.description && <p className="plan-public-desc">{item.description}</p>}
                        <p className="plan-public-by">by {item.creatorUsername || 'Anonymous'}</p>
                        <span className="plan-public-view-hint">View</span>
                      </div>
                      <div className="plan-public-card-actions">
                        <button type="button" className="plan-public-btn" onClick={(e) => { e.stopPropagation(); isLoggedIn ? onAddToFolder?.(item) : onOpenSignUp?.(); }} title={isLoggedIn ? 'Add to your folder' : 'Sign in to add'}>{isLoggedIn ? 'Add to folder' : 'Sign in to add'}</button>
                      </div>
                    </li>
                  ))}
                  </ul>
                  <button
                    type="button"
                    className="plan-public-scroll-btn"
                    onClick={() => scrollRow(testRef, 1)}
                    aria-label="Scroll right"
                    disabled={tests.length <= 3}
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
