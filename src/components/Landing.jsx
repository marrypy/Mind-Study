import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { loadStudyData } from '../lib/studyStorage.js';
import { getAllStudyPlans, getPlanLabel } from '../lib/studyPlans.js';
import '../css/Landing.css';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBREV = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

function normalizeDay(day) {
  if (!day) return '';
  const d = String(day).trim();
  return DAY_ABBREV[d] || (DAY_ORDER.includes(d) ? d : '');
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

function formatDateShort(d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function formatDateLong(d) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

function formatDateFromISO(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const d = new Date(dateStr + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? dateStr : formatDateLong(d);
}

function parseActivity(activity) {
  if (!activity) return { subject: 'Study', duration: '' };
  const match = String(activity).match(/^(.+?)\s*[•·\-]\s*(\d+)\s*min\)?$|^(.+?)\s*\((\d+)\s*min\)$/);
  if (match) {
    const subject = (match[1] || match[3] || activity).trim();
    const duration = match[2] || match[4] || '';
    return { subject, duration: duration ? `${duration} min` : '' };
  }
  const paren = String(activity).match(/^(.+?)\s*\((\d+)\s*min\)$/);
  if (paren) return { subject: paren[1].trim(), duration: `${paren[2]} min` };
  return { subject: activity, duration: '' };
}

const HOW_IT_WORKS = [
  { title: 'Mental Health First', description: 'Plans that consider your well-being' },
  { title: 'Personalized Schedule', description: 'Tailored to your energy and commitments' },
  { title: 'Goal-Oriented', description: 'Focused on what matters to you' },
  { title: 'AI-Optimized', description: 'Smart study blocks for maximum efficiency' },
];

const OTHERS_ITEMS = ['Manual flashcards', 'Manual study guides', 'Lack of study guidance', 'Time consuming'];
const MIND_STUDY_ITEMS = ['AI generated flashcards', 'AI generated study guides', 'Guidance on study techniques', 'Time saver'];

const TYPEWRITER_FULL = 'The first wellness study platform';
const TYPEWRITER_SPEED_MS = 60;
const TYPEWRITER_CURSOR_BLINK_MS = 530;

function useFadeInOnScroll(opts = {}) {
  const { threshold = 0.08, rootMargin = '0px 0px -40px 0px' } = opts;
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold, rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, inView];
}

function FadeInOnScroll({ as: Component = 'div', className = '', children, ...rest }) {
  const [ref, inView] = useFadeInOnScroll();
  const resolvedClassName = `${className}${inView ? ' landing-in-view' : ''}`.trim();
  return React.createElement(Component, { ref, className: resolvedClassName, ...rest }, children);
}

function TypewriterTitle() {
  const [text, setText] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    if (text.length < TYPEWRITER_FULL.length) {
      const t = setTimeout(() => setText(TYPEWRITER_FULL.slice(0, text.length + 1)), TYPEWRITER_SPEED_MS);
      return () => clearTimeout(t);
    }
  }, [text]);

  useEffect(() => {
    const t = setInterval(() => setCursorVisible((v) => !v), TYPEWRITER_CURSOR_BLINK_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <h1 className="landing-title text-gradient">
      <span className="landing-title-inner">{text}</span>
      <span className={`landing-title-cursor ${cursorVisible ? 'landing-title-cursor--on' : ''}`} aria-hidden>{'|'}</span>
    </h1>
  );
}

const AURA_FADE_DISTANCE = 420;

export default function Landing({ onGetStarted, onGeneratePlan, onGenerateClassFolder, onOpenFolder, onOpenPlan }) {
  const { user, isLoggedIn } = useAuth();
  const [folders, setFolders] = useState([]);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [auraOpacity, setAuraOpacity] = useState(1);
  const [showFullTimeline, setShowFullTimeline] = useState(false);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY ?? document.documentElement.scrollTop;
      const opacity = Math.max(0, 1 - y / AURA_FADE_DISTANCE);
      setAuraOpacity(opacity);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !user?.id) return;
    const { folders: f } = loadStudyData(user.id);
    setFolders(f || []);
    setPlansLoading(true);
    getAllStudyPlans()
      .then((rows) => {
        const withContent = (rows || []).filter((row) => {
          const p = row?.plan;
          if (!p) return false;
          return (p.technique && p.technique.trim()) || (p.considerations && p.considerations.length > 0) || (p.weeklyTimeline && p.weeklyTimeline.length > 0) || (p.studyBlocks && p.studyBlocks.length > 0);
        });
        setPlans(withContent);
      })
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, [isLoggedIn, user?.id]);

  const latestPlan = plans[0]?.plan;
  const isTestPlan = latestPlan?.planType === 'test';
  const hasDateEntries = (latestPlan?.weeklyTimeline || []).some((e) => e.date);
  const useDateTimeline = isTestPlan && hasDateEntries;

  const timelineByDay = useMemo(() => {
    const weeklyTimeline = latestPlan?.weeklyTimeline || [];
    return weeklyTimeline.reduce((acc, entry) => {
      const day = normalizeDay(entry.day || '');
      if (!day) return acc;
      if (!acc[day]) acc[day] = [];
      acc[day].push(entry);
      return acc;
    }, {});
  }, [latestPlan]);

  const timelineByDate = useMemo(() => {
    if (!useDateTimeline) return {};
    const weeklyTimeline = latestPlan?.weeklyTimeline || [];
    return weeklyTimeline.reduce((acc, entry) => {
      const dateStr = entry.date && String(entry.date).trim();
      if (!dateStr) return acc;
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(entry);
      return acc;
    }, {});
  }, [latestPlan, useDateTimeline]);

  const sortedTimelineDates = useMemo(() => {
    if (!useDateTimeline) return [];
    return [...new Set((latestPlan?.weeklyTimeline || []).map((e) => e.date).filter(Boolean))].sort();
  }, [latestPlan, useDateTimeline]);

  const hasExtraTimelineDays = useDateTimeline && sortedTimelineDates.length > 7;
  const visibleTimelineDates = useDateTimeline && hasExtraTimelineDays && !showFullTimeline
    ? sortedTimelineDates.slice(0, 7)
    : sortedTimelineDates;

  const weekDates = useMemo(() => getWeekDates(), []);

  if (isLoggedIn) {
    return (
      <div className="landing" style={{
          top: '6rem',
          position: 'relative',
        }}>
        <div className="landing-aura" style={{ opacity: auraOpacity }} aria-hidden />
        <h1 className="landing-title text-gradient" >MindStudy AI</h1>
        <p className="landing-description">
          Study with ease using integrated flashcards, study guides, practice tests, and lecture recordings while taking advantage of AI powered study plans based on your mood, health, and time commitments.
        </p>

        <div className="landing-logged-in-actions">
          <button type="button" className="landing-cta landing-cta--primary" onClick={onGeneratePlan}>
            Generate plan
          </button>
          <button type="button" className="landing-cta landing-cta--secondary" onClick={onGenerateClassFolder}>
            Generate class folder
          </button>
        </div>

        <FadeInOnScroll as="section" className="landing-section landing-review" aria-labelledby="review-heading">
          <h2 className="landing-review-subheading">Folders</h2>
          {folders.length === 0 ? (
            <p className="landing-review-empty">No Folders Yet</p>
          ) : (
            <div className="landing-review-cards">
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="landing-review-card"
                  onClick={() => onOpenFolder && onOpenFolder(f)}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}

          <h2 className="landing-review-subheading">Plans</h2>
          {plansLoading ? (
            <p className="landing-review-empty">Loading…</p>
          ) : plans.length === 0 ? (
            <p className="landing-review-empty">No plans yet</p>
          ) : (
            <div className="landing-review-cards">
              {plans.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="landing-review-card"
                  onClick={() => onOpenPlan && onOpenPlan(row)}
                >
                  {getPlanLabel(row)}
                </button>
              ))}
            </div>
          )}
        </FadeInOnScroll>

        <FadeInOnScroll as="section" className="landing-section landing-timeline" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="landing-section-title">Timeline</h2>
          <p className="landing-timeline-hint">
            {useDateTimeline ? 'Your study timeline from your most recent plan' : 'Your week from your most recent plan'}
          </p>
          {plans.length === 0 || !latestPlan ? (
            <p className="landing-review-empty">No plan yet. Generate a plan to see your week.</p>
          ) : (
            <div className="timeline-track">
              <div className="timeline-line" aria-hidden />
              {useDateTimeline
                ? visibleTimelineDates.map((dateStr, index) => {
                    const entries = timelineByDate[dateStr] || [];
                    const isLeft = index % 2 === 0;
                    const cardContent = (
                      <div className="timeline-card">
                        <span className="timeline-card-date">{formatDateFromISO(dateStr)}</span>
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
                        {onOpenPlan && plans[0] && (
                          <button
                            type="button"
                            className="timeline-card-link"
                            onClick={() => onOpenPlan(plans[0])}
                          >
                            View plan →
                          </button>
                        )}
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
                        <span className="timeline-card-date">{formatDateLong(date)}</span>
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
                        {onOpenPlan && plans[0] && (
                          <button
                            type="button"
                            className="timeline-card-link"
                            onClick={() => onOpenPlan(plans[0])}
                          >
                            View plan →
                          </button>
                        )}
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
          )}
          {useDateTimeline && hasExtraTimelineDays && (
            <div className="landing-timeline-toggle-row">
              <button
                type="button"
                className="timeline-toggle-button"
                onClick={() => setShowFullTimeline((prev) => !prev)}
              >
                {showFullTimeline ? 'Show first 7 days' : `Show all ${sortedTimelineDates.length} days`}
              </button>
            </div>
          )}
        </FadeInOnScroll>

        <button type="button" className="landing-help" aria-label="Help">?</button>
      </div>
    );
  }

  return (
    <div className="landing landing--guest">
      <div className="landing-aura" style={{ opacity: auraOpacity }} aria-hidden />
      <FadeInOnScroll as="div" className="landing-hero">
        <div className="landing-glow" aria-hidden />
        <TypewriterTitle />
        <p className="landing-description">
          Study with ease using integrated flashcards, study guides from your materials, and lecture recordings while taking advantage of AI powered study plans based on your mood, health, and time commitments.
        </p>
      </FadeInOnScroll>

      <FadeInOnScroll as="section" className="landing-section" aria-labelledby="how-it-works-heading" id="hiw">
        <h2 id="how-it-works-heading" className="landing-section-title">How It Works</h2>
        <div className="landing-cards">
          {HOW_IT_WORKS.map((f) => (
            <div key={f.title} className="landing-card">
              <h3 className="landing-card-title">{f.title}</h3>
              <p className="landing-card-desc">{f.description}</p>
            </div>
          ))}
        </div>
      </FadeInOnScroll>

      <FadeInOnScroll as="section" className="landing-section landing-section--standalone" aria-labelledby="how-different-heading" id="hdh">
        <h2 id="how-different-heading" className="landing-section-title">How Are We Different?</h2>
        <div className="landing-compare">
          <div className="landing-compare-card landing-compare-others">
            <h3 className="landing-compare-card-title">Others</h3>
            <ul className="landing-compare-list">
              {OTHERS_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="landing-compare-card landing-compare-mindstudy">
            <h3 className="landing-compare-card-title">MindStudy AI</h3>
            <ul className="landing-compare-list">
              {MIND_STUDY_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </FadeInOnScroll>

      <FadeInOnScroll as="section" className="landing-section landing-section-getting-started" aria-labelledby="getting-started-heading" id="getting-started">
        <h2 id="getting-started-heading" className="landing-section-title">Getting Started</h2>
        <div className="landing-steps">
          <div className="landing-step">
            <span className="landing-step-num">1</span>
            <div className="landing-step-content">
              <h3 className="landing-step-title">Create an account</h3>
              <p className="landing-step-desc">Sign up to save your plans and sync across devices. Your data stays private.</p>
            </div>
          </div>
          <div className="landing-step">
            <span className="landing-step-num">2</span>
            <div className="landing-step-content">
              <h3 className="landing-step-title">Fill in the study plan form</h3>
              <p className="landing-step-desc">Share your mood, goals, schedule, and any deadlines so we can tailor your plan.</p>
            </div>
          </div>
          <div className="landing-step">
            <span className="landing-step-num">3</span>
            <div className="landing-step-content">
              <h3 className="landing-step-title">Get your AI study plan and start studying</h3>
              <p className="landing-step-desc">Receive a personalized weekly plan and use flashcards, study guides, and the timer to stay on track.</p>
            </div>
          </div>
        </div>
      </FadeInOnScroll>

      <FadeInOnScroll as="section" className="landing-section landing-section-cta" aria-labelledby="ready-heading">
        <h2 id="ready-heading" className="landing-section-title">Ready To Start?</h2>
        <button type="button" className="landing-cta" onClick={onGetStarted}>
          Get Started Free
        </button>
        <p className="landing-disclaimer">
         Takes up to 2 minutes • Your data stays private.
        </p>
      </FadeInOnScroll>

      <button type="button" className="landing-help" aria-label="Help">?</button>
    </div>
  );
}
