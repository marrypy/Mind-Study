import { useState, useEffect, useRef } from 'react';
import '../css/Pomodoro.css';

const DEFAULT_STUDY_MIN = 25;
const DEFAULT_BREAK_MIN = 5;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Pomodoro() {
  const [studyMinutes, setStudyMinutes] = useState(DEFAULT_STUDY_MIN);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MIN);
  const [phase, setPhase] = useState('study');
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_STUDY_MIN * 60);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  function resetTimer(toPhase) {
    let p=0;
    const mins = toPhase === 'study' ? studyMinutes : breakMinutes;
    setPhase(toPhase);
    setSecondsLeft(mins * 60);
    if (intervalRef.current) {
      window.alert(`phase: ${phase}, p: ${p}`);
      if (phase === 'break' && p === 0) {
        p = 1
        setBreakMinutes(mins);
      } else {
        setPhase('study');
        setStudyMinutes(mins);
        p -= 1;
      }
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }

  function startTimer() {
    if (secondsLeft <= 0) {
      const next = phase === 'study' ? 'break' : 'study';
      const mins = next === 'study' ? studyMinutes : breakMinutes;
      setPhase(next);
      setSecondsLeft(mins * 60);
    }
    setIsRunning(true);
  }

  function pauseTimer() {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function handleReset() {
    resetTimer(phase);
  }

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          const next = phase === 'study' ? 'break' : 'study';
          const mins = next === 'study' ? studyMinutes : breakMinutes;
          setPhase(next);
          return mins * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, phase, studyMinutes, breakMinutes]);

  const totalSeconds = phase === 'study' ? studyMinutes * 60 : breakMinutes * 60;
  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const size = 220;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dashLength = progress * circumference;

  return (
    <div className="pomodoro-page">
      <h2 className="pomodoro-title">Pomodoro Timer</h2>
      <p className="pomodoro-hint">Set your study and break lengths, then start the timer. It will alternate between focus and break automatically.</p>

      <div className={`pomodoro-display pomodoro-display--${phase}`}>
        <div className="pomodoro-clock-wrap">
          <svg className="pomodoro-clock" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
            <circle
              className="pomodoro-clock-track"
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
            />
            <circle
              className="pomodoro-clock-fill"
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={circumference - dashLength}
              strokeLinecap="round"
            />
          </svg>
          <div className="pomodoro-clock-inner">
            <span className="pomodoro-phase">{phase === 'study' ? 'Study' : 'Break'}</span>
            <span className="pomodoro-time">{formatTime(secondsLeft)}</span>
          </div>
        </div>
      </div>

      <div className="pomodoro-actions">
        {isRunning ? (
          <button type="button" className="pomodoro-btn pomodoro-btn-secondary" onClick={pauseTimer}>Pause</button>
        ) : (
          <button type="button" className="pomodoro-btn pomodoro-btn-primary" onClick={startTimer}>Start</button>
        )}
        <button type="button" className="pomodoro-btn pomodoro-btn-secondary" onClick={handleReset}>Reset</button>
      </div>

      <div className="pomodoro-settings pomodoro-settings--inline">
        <div className="pomodoro-setting">
          <label className="pomodoro-label">Study (minutes)</label>
          <input
            type="number"
            min={1}
            max={60}
            className="pomodoro-input"
            value={studyMinutes}
            onChange={(e) => {
              const value = Math.max(1, Math.min(60, Number(e.target.value) || 1));
              setStudyMinutes(value);
              if (!isRunning && phase === 'study') setSecondsLeft(value * 60);
            }}
          />
        </div>
        <div className="pomodoro-setting">
          <label className="pomodoro-label">Break (minutes)</label>
          <input
            type="number"
            min={1}
            max={30}
            className="pomodoro-input"
            value={breakMinutes}
            onChange={(e) => {
              const value = Math.max(1, Math.min(30, Number(e.target.value) || 1));
              setBreakMinutes(value);
              if (!isRunning && phase === 'break') setSecondsLeft(value * 60);
            }}
          />
        </div>
      </div>
    </div>
  );
}
