import { useState, useEffect } from 'react';
import { getAllStudyPlans, getPlanLabel, deleteStudyPlan } from '../lib/studyPlans.js';
import '../css/PlanList.css';

function fetchPlans() {
  return getAllStudyPlans().then((rows) => {
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
    return withContent;
  });
}

export default function PlanList({ onSelectPlan, onCreatePlan }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPlans()
      .then(setPlans)
      .catch((err) => setError(err.message || 'Failed to load plans'))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(e, row) {
    e.stopPropagation();
    if (deletingId === row.id) return;
    if (!window.confirm(`Delete the plan for ${getPlanLabel(row)}? This cannot be undone.`)) return;
    setDeletingId(row.id);
    try {
      await deleteStudyPlan(row.id);
      setPlans((prev) => prev.filter((p) => p.id !== row.id));
    } catch (err) {
      setError(err?.message || 'Failed to delete plan');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="plan-list">
        <div className="plan-list-loading">Loading your plans…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="plan-list">
        <h2 className="plan-list-title">Your plans</h2>
        <div className="plan-list-empty">
          <p>We couldn’t load your plans right now. Create a new plan below.</p>
          <button type="button" className="plan-list-btn-primary" onClick={onCreatePlan}>
            Create a plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="plan-list">
      <h2 className="plan-list-title">Your plans</h2>
      <p className="plan-list-subtitle">Choose a week to view that plan.</p>
      {plans.length === 0 ? (
        <div className="plan-list-empty">
          <p>You don’t have a saved plan yet.</p>
          <button type="button" className="plan-list-btn-primary" onClick={onCreatePlan}>
            Create a plan
          </button>
        </div>
      ) : (
        <ul className="plan-list-ul">
          {plans.map((row) => (
            <li key={row.id} className="plan-list-week-li">
              <button
                type="button"
                className="plan-list-week-card"
                onClick={() => onSelectPlan(row)}
              >
                <span className="plan-list-week-label">{getPlanLabel(row)}</span>
              </button>
              <button
                type="button"
                className="plan-list-week-delete"
                onClick={(e) => handleDelete(e, row)}
                disabled={deletingId === row.id}
                aria-label={`Delete plan for ${getPlanLabel(row)}`}
                title="Delete plan"
              >
                {deletingId === row.id ? '…' : '×'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {plans.length > 0 && (
        <div className="plan-list-create-wrap">
          <button type="button" className="plan-list-btn-secondary" onClick={onCreatePlan}>
            Create new plan
          </button>
        </div>
      )}
    </div>
  );
}
