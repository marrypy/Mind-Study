import { useState } from 'react';
import '../css/ContextForm.css';

const MOOD_OPTIONS = ['Great', 'Good', 'Okay', 'Low', 'Anxious', 'Overwhelmed', 'Sick'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ContextForm({ onSubmit, isLoading }) {
  const [mood, setMood] = useState('');
  const [circumstances, setCircumstances] = useState('');
  const [hasAdhd, setHasAdhd] = useState(false);
  const [medTimes, setMedTimes] = useState('');
  const [medNotes, setMedNotes] = useState('');
  const [sickness, setSickness] = useState('');
  const [weekPlans, setWeekPlans] = useState('');
  const [classes, setClasses] = useState('');
  const [goals, setGoals] = useState('');
  const [deadlines, setDeadlines] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      mood,
      circumstances,
      hasAdhd,
      medTimes: hasAdhd ? medTimes : '',
      medNotes: hasAdhd ? medNotes : '',
      sickness,
      weekPlans,
      classes,
      goals,
      deadlines,
    });
  }

  return (
    <form className="context-form" onSubmit={handleSubmit}>
      <section className="form-section">
        <h2>How you're doing</h2>
        <label>
          <span>Mood</span>
          <select aria-label="Field" value={mood} onChange={(e) => setMood(e.target.value)}>
            <option value="">Selectâ¦</option>
            {MOOD_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Circumstances (anything that affects focus or energy)</span>
          <textarea aria-label="Field"
            value={circumstances}
            onChange={(e) => setCircumstances(e.target.value)}
            placeholder="e.g. poor sleep, busy week, life stress, energy levelâ¦"
            rows={3}
          />
        </label>
        <label>
          <span>Sickness / health</span>
          <input aria-label="Field"
            type="text"
            value={sickness}
            onChange={(e) => setSickness(e.target.value)}
            placeholder="e.g. none, mild cold, recoveringâ¦"
          />
        </label>
      </section>

      <section className="form-section">
        <h2>ADHD & medication (optional)</h2>
        <label className="checkbox-label">
          <input aria-label="Field"
            type="checkbox"
            checked={hasAdhd}
            onChange={(e) => setHasAdhd(e.target.checked)}
          />
          <span>I take ADHD medication and want timing in my plan</span>
        </label>
        {hasAdhd && (
          <>
            <label>
              <span>Medication times (e.g. 8:00, 14:00)</span>
              <input aria-label="Field"
                type="text"
                value={medTimes}
                onChange={(e) => setMedTimes(e.target.value)}
                placeholder="8:00 AM, 2:00 PM"
              />
            </label>
            <label>
              <span>Notes (e.g. with food, avoid caffeine)</span>
              <input aria-label="Field"
                type="text"
                value={medNotes}
                onChange={(e) => setMedNotes(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </>
        )}
      </section>

      <section className="form-section">
        <h2>Your week & schedule</h2>
        <label>
          <span>Plans or commitments this week</span>
          <textarea aria-label="Field"
            value={weekPlans}
            onChange={(e) => setWeekPlans(e.target.value)}
            placeholder="e.g. Tue 2â4 dentist, Thu evening offâ¦"
            rows={2}
          />
        </label>
      </section>

      <section className="form-section">
        <h2>What to study</h2>
        <label>
          <span>Classes or subjects</span>
          <textarea aria-label="Field"
            value={classes}
            onChange={(e) => setClasses(e.target.value)}
            placeholder="e.g. Math 101, Biology, Spanishâ¦"
            rows={2}
          />
        </label>
        <label>
          <span>Goals (what you want to achieve)</span>
          <textarea aria-label="Field"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="e.g. finish Ch. 3, practice problems, vocabâ¦"
            rows={2}
          />
        </label>
        <label>
          <span>Deadlines</span>
          <textarea aria-label="Field"
            value={deadlines}
            onChange={(e) => setDeadlines(e.target.value)}
            placeholder="e.g. Essay due Fri 5pm, quiz Wed 10amâ¦"
            rows={2}
          />
        </label>
      </section>

      <div className="form-actions">
        <button aria-label="Button" type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? 'Building your planâ¦' : 'Generate study plan'}
        </button>
      </div>
    </form>
  );
}

export { MOOD_OPTIONS, DAYS };
