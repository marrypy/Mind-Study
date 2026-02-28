import { useState } from 'react';
import { importWeekFromGoogleCalendar } from '../lib/googleCalendar.js';
import '../css/OnboardingWizard.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

const MOOD_OPTIONS = ['Great', 'Good', 'Okay', 'Low', 'Anxious', 'Overwhelmed', 'Sick'];

const ALL_STEPS = [
  { id: 'name', title: "First, what's your name?" },
  { id: 'mood', title: "How's your mood today?" },
  { id: 'circumstances', title: 'Anything affecting your focus or energy?' },
  { id: 'mentalHealth', title: 'Is there anything about your mental health we should consider?' },
  { id: 'week', title: "What's going on this week?" },
  { id: 'classes', title: 'What do you want to study?' },
  { id: 'goals', title: 'What are your goals?' },
  { id: 'deadlines', title: 'Any deadlines?' },
  { id: 'extra', title: 'Anything else we should know?' },
  { id: 'account', title: 'Save your plan to an account?' },
];

function StepContent({ stepId, name, setName, mood, setMood, circumstances, setCircumstances, sickness, setSickness, mentalHealth, setMentalHealth, weekPlans, setWeekPlans, weekCalendarLoading, weekCalendarError, onImportWeekFromCalendar, classes, setClasses, goals, setGoals, deadlines, setDeadlines, extra, setExtra, isLoggedIn, onOpenSignUp, onOpenLogIn }) {
  if (stepId === 'name') {
    return (
      <div className="wizard-field">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" className="wizard-input" />
      </div>
    );
  }
  if (stepId === 'mood') {
    return (
      <div className="wizard-field">
        <select value={mood} onChange={(e) => setMood(e.target.value)}>
          <option value="">Select your mood…</option>
          {MOOD_OPTIONS.map((m) => (<option key={m} value={m}>{m}</option>))}
        </select>
      </div>
    );
  }
  if (stepId === 'circumstances') {
    return (
      <div className="wizard-fields">
        <div className="wizard-field">
          <label>
            <span>Circumstances (sleep, stress, energy…)</span>
            <textarea value={circumstances} onChange={(e) => setCircumstances(e.target.value)} placeholder="e.g. poor sleep, busy week, life stress…" rows={3} />
          </label>
        </div>
        <div className="wizard-field">
          <label>
            <span>Sickness / health (optional)</span>
            <input type="text" value={sickness} onChange={(e) => setSickness(e.target.value)} placeholder="e.g. none, mild cold…" />
          </label>
        </div>
      </div>
    );
  }
  if (stepId === 'mentalHealth') {
    return (
      <div className="wizard-field">
        <textarea value={mentalHealth} onChange={(e) => setMentalHealth(e.target.value)} placeholder="e.g. ADHD, anxiety, medication timing, depression…" rows={4} />
      </div>
    );
  }
  if (stepId === 'week') {
    return (
      <div className="wizard-field wizard-week">
        <p className="wizard-week-hint">Add your time commitments so we can schedule around them.</p>
        <button
          type="button"
          className="wizard-week-google-btn"
          onClick={onImportWeekFromCalendar}
          disabled={weekCalendarLoading || !GOOGLE_CLIENT_ID}
        >
          {weekCalendarLoading ? 'Connecting…' : 'Connect Google Calendar'}
        </button>
        {!GOOGLE_CLIENT_ID && (
          <p className="wizard-week-google-missing">Google sign-in is not configured. Enter your plans below or add VITE_GOOGLE_CLIENT_ID to your env.</p>
        )}
        {weekCalendarError && (
          <p className="wizard-week-error" role="alert">{weekCalendarError}</p>
        )}
        <label className="wizard-week-manual">
          <span>Or enter your plans manually</span>
          <textarea value={weekPlans} onChange={(e) => setWeekPlans(e.target.value)} placeholder="e.g. Tue 2–4 dentist, Thu evening off…" rows={4} />
        </label>
      </div>
    );
  }
  if (stepId === 'classes') {
    return (
      <div className="wizard-field">
        <label>
          <span>Classes or subjects</span>
          <textarea value={classes} onChange={(e) => setClasses(e.target.value)} placeholder="e.g. Math 101, Biology, Spanish…" rows={3} />
        </label>
      </div>
    );
  }
  if (stepId === 'goals') {
    return (
      <div className="wizard-field">
        <label>
          <span>What do you want to achieve?</span>
          <textarea value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="e.g. finish Ch. 3, practice problems, vocab…" rows={3} />
        </label>
      </div>
    );
  }
  if (stepId === 'deadlines') {
    return (
      <div className="wizard-field">
        <label>
          <span>Deadlines</span>
          <textarea value={deadlines} onChange={(e) => setDeadlines(e.target.value)} placeholder="e.g. Essay due Fri 5pm, quiz Wed 10am…" rows={3} />
        </label>
      </div>
    );
  }
  if (stepId === 'extra') {
    return (
      <div className="wizard-field">
        <textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Optional — anything else that might affect your plan…" rows={3} />
      </div>
    );
  }
  if (stepId === 'account' && !isLoggedIn) {
    return (
      <div className="wizard-account-step">
        <p className="wizard-account-text">Sign up or log in to save your plan and access it from any device.</p>
        <div className="wizard-account-buttons">
          {onOpenSignUp && <button type="button" className="wizard-account-btn wizard-account-btn--primary" onClick={onOpenSignUp}>Sign up</button>}
          {onOpenLogIn && <button type="button" className="wizard-account-btn" onClick={onOpenLogIn}>Log in</button>}
        </div>
      </div>
    );
  }
  return null;
}

export default function OnboardingWizard({ onSubmit, onBack, isLoading, onOpenSignUp, onOpenLogIn, isLoggedIn }) {
  const steps = isLoggedIn ? ALL_STEPS.filter((s) => s.id !== 'account' && s.id !== 'name') : ALL_STEPS;
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [mood, setMood] = useState('');
  const [circumstances, setCircumstances] = useState('');
  const [sickness, setSickness] = useState('');
  const [mentalHealth, setMentalHealth] = useState('');
  const [weekPlans, setWeekPlans] = useState('');
  const [classes, setClasses] = useState('');
  const [goals, setGoals] = useState('');
  const [deadlines, setDeadlines] = useState('');
  const [extra, setExtra] = useState('');
  const [weekCalendarLoading, setWeekCalendarLoading] = useState(false);
  const [weekCalendarError, setWeekCalendarError] = useState(null);

  async function handleImportWeekFromCalendar() {
    setWeekCalendarError(null);
    setWeekCalendarLoading(true);
    try {
      const text = await importWeekFromGoogleCalendar(GOOGLE_CLIENT_ID, GOOGLE_API_KEY);
      setWeekPlans(text);
    } catch (err) {
      const msg = err?.message || '';
      const is403 = msg.includes('access_denied') || msg.includes('verification') || msg.includes('403');
      setWeekCalendarError(
        is403
          ? 'This app is in testing mode. Add your email as a test user in Google Cloud Console (APIs & Services → OAuth consent screen → Test users), or enter your plans manually below.'
          : (msg || 'Could not load calendar. Try entering manually below.')
      );
    } finally {
      setWeekCalendarLoading(false);
    }
  }

  const step = steps[stepIndex];
  const totalSteps = steps.length;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;
  const showLongForm = isLoggedIn;

  function getContext() {
    return {
      name: name.trim(),
      mood,
      circumstances,
      mentalHealth: mentalHealth.trim(),
      sickness,
      weekPlans,
      classes,
      goals,
      deadlines,
      extra: extra.trim(),
    };
  }

  function handleSubmitForm(e) {
    e.preventDefault();
    onSubmit(getContext());
  }

  function handleNext(e) {
    e.preventDefault();
    if (isLast) {
      onSubmit(getContext());
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function handleBack() {
    if (isFirst) {
      onBack();
    } else {
      setStepIndex((i) => i - 1);
    }
  }

  const stepContentProps = {
    name, setName, mood, setMood, circumstances, setCircumstances, sickness, setSickness,
    mentalHealth, setMentalHealth, weekPlans, setWeekPlans,
    weekCalendarLoading, weekCalendarError, onImportWeekFromCalendar: handleImportWeekFromCalendar,
    classes, setClasses, goals, setGoals, deadlines, setDeadlines, extra, setExtra,
    isLoggedIn, onOpenSignUp, onOpenLogIn,
  };

  if (showLongForm) {
    return (
      <div className="wizard wizard--long">
        <form className="wizard-long-form" onSubmit={handleSubmitForm}>
          <h2 className="wizard-long-title">Create your plan</h2>
          <p className="wizard-long-hint">Fill in the sections below. Your plan will be saved to your account.</p>
          {steps.map((s) => (
            <div key={s.id} className="wizard-long-card">
              <h3 className="wizard-question">{s.title}</h3>
              <StepContent stepId={s.id} {...stepContentProps} />
            </div>
          ))}
          <div className="wizard-actions">
            <button type="button" className="btn-secondary" onClick={handleBack}>← Back</button>
            <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Building your plan…' : 'Generate my plan'}</button>
          </div>
        </form>
        <p className="wizard-footer-note">All your data stays private.</p>
      </div>
    );
  }

  return (
    <div className="wizard">
      <div className="wizard-progress-wrap">
        <div className="wizard-progress-bar">
          <div className="wizard-progress-fill" style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }} />
        </div>
        <p className="wizard-progress-label">Question {stepIndex + 1} of {totalSteps}</p>
      </div>

      <form className="wizard-form" onSubmit={handleNext}>
        <h2 className="wizard-question">{step.title}</h2>
        <StepContent stepId={step.id} {...stepContentProps} />
        <div className="wizard-actions">
          <button type="button" className="btn-secondary" onClick={handleBack}>
            {isFirst ? 'Back' : 'Previous'}
          </button>
          <button type="submit" className="btn-primary" disabled={isLoading && isLast}>
            {isLoading && isLast ? 'Building your plan…' : isLast ? 'Generate my plan' : 'Next'}
          </button>
        </div>
      </form>

      <p className="wizard-footer-note">Press Enter to continue. All your data stays private.</p>

      <button type="button" className="wizard-help" aria-label="Help">?</button>
    </div>
  );
}
