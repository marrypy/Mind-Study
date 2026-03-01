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

export default function StudyPlan({ plan, onBack, error, saveError }) {
  if (!plan) return null;

  const {
    summary,
    technique,
    techniqueDescription,
    considerations,
    medReminders,
    deadlines,
    studyBlocks,
    tips,
    weeklyTimeline,
  } = plan;

  const tipCards = Array.isArray(tips) ? tips.slice(0, 4) : [];
  while (tipCards.length < 4) tipCards.push('Stay consistent and take breaks.');
  const tipCardsWithMeta = tipCards.map((t, i) => tipToCard(t, i));

  const weekDates = getWeekDates();
  const timelineByDay = (weeklyTimeline || []).reduce((acc, entry) => {
    const day = normalizeDay(entry.day || '');
    if (!day) return acc;
    if (!acc[day]) acc[day] = [];
    acc[day].push(entry);
    return acc;
  }, {});

  const considerationLines = [...considerations];
  if (medReminders?.length) {
    considerationLines.push(`Medication: ${medReminders.map((m) => m.time).join(', ')}${medReminders[0]?.note ? ` — ${medReminders[0].note}` : ''}`);
  }

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
        {summary && techniqueDescription && (
          <p className="plan-summary">{summary}</p>
        )}
      </div>

      <div className="plan-two-col">
        <section className="plan-box plan-box-considerations">
          <h2 className="plan-box-title" style={{textDecoration: 'underline'}}>
            Important Considerations
          </h2>
          <ul className="plan-box-list">
            {considerationLines.length > 0 ? (
              considerationLines.map((c, i) => (
                <li key={i}>{c}</li>
              ))
            ) : (
              <li>None — we've built a general plan for you.</li>
            )}
          </ul>
        </section>
        <section className="plan-box plan-box-deadlines">
          <h2 className="plan-box-title" style={{textDecoration: 'underline'}}>
            Upcoming Deadlines
          </h2>
          <ul className="plan-box-list">
            {deadlines?.length > 0 ? (
              deadlines.map((d, i) => (
                <li key={i}>
                  <span className="deadline-label">{d.label}</span>
                  {d.suggested && <span className="deadline-tip"> — {d.suggested}</span>}
                </li>
              ))
            ) : (
              <li className="deadline-na">N/A</li>
            )}
          </ul>
        </section>
      </div>

      <section className="plan-section plan-section-tips">
        <h2 className="plan-section-heading">
          Tips for Success
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
          Your Week at a Glance
        </h2>
        <div className="timeline-track">
          <div className="timeline-line" aria-hidden />
          {weekDates.map(({ day, date }, index) => {
            const entries = timelineByDay[day] || [];
            const isLeft = index % 2 === 0;
            const cardContent = (
              <div className="timeline-card">
                <span className="timeline-card-date">{formatDateLong(date, day)}</span>
                <span className={`timeline-card-tag ${entries.length > 0 ? 'timeline-card-tag--study' : 'timeline-card-tag--rest'}`}>
                  {entries.length > 0 ? 'STUDY' : 'REST'}
                </span>
                <p className="timeline-card-desc">
                  {entries.length > 0
                    ? entries
                        .map((e) => {
                          const { subject } = parseActivity(e.activity);
                          return `${subject || e.activity} at ${e.time}`;
                        })
                        .join(' · ')
                    : 'No scheduled activities'}
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
      </section>

      <section className="plan-section plan-section-blocks">
        <h2 className="plan-section-heading" style={{textDecoration: 'underline'}}>
       
          Detailed Study Blocks
        </h2>
        <div className="blocks-by-day">
          {DAY_ORDER.filter((day) => blocksByDay[day]?.length).map((day) => (
            <div key={day} className="block-day-group">
              <h3 className="block-day-title">{day}</h3>
              <p className="block-day-subtitle">{blocksByDay[day].length} study session{blocksByDay[day].length !== 1 ? 's' : ''}</p>
              <div className="block-day-cards">
                {blocksByDay[day].map((block, j) => (
                  <div key={j} className="study-block-card">
                    <div className="study-block-card-main">
                      <span className="study-block-time"> {block.time}</span>
                      <span className="study-block-subject"> {block.subject}</span>
                      <p className="study-block-meta">{block.sessionType} • {block.duration}</p>
                    </div>
                    <span className={`study-block-priority study-block-priority-${block.priority}`}>
                      {block.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {studyBlocks?.length > 0 && Object.keys(blocksByDay).length === 0 && (
          <div className="block-grid fallback-blocks">
            {studyBlocks.map((block) => (
              <div key={block.id} className="study-block-card">
                <div className="study-block-card-main">
                  <span className="study-block-time"> {block.suggestedTime}</span>
                  <span className="study-block-subject"> {block.title}</span>
                  <p className="study-block-meta">{block.durationMinutes} min</p>
                </div>
                <span className="study-block-priority study-block-priority-medium">medium</span>
              </div>
            ))}
          </div>
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
