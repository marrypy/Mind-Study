import { useState } from 'react';
import '../css/Study.css';

export default function PublicItemViewer({ item, onClose }) {
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [testQuestionIndex, setTestQuestionIndex] = useState(0);
  const [testSelected, setTestSelected] = useState(null);
  const [testShowResult, setTestShowResult] = useState(false);
  const [testScore, setTestScore] = useState({ correct: 0, total: 0 });

  if (!item) return null;

  if (item.type === 'flashcards') {
    const cards = item.data?.cards || [];
    const idx = Math.min(flashcardIndex, Math.max(0, cards.length - 1));
    const card = cards[idx];
    return (
      <div className="study-viewer">
        <div className="study-viewer-header">
          <button type="button" className="study-viewer-back" onClick={onClose}>← Back</button>
          <span className="study-viewer-title">{item.title}</span>
          <span className="study-viewer-nav">{idx + 1} / {cards.length}</span>
        </div>
        {item.creatorUsername && (
          <p className="study-viewer-by">by {item.creatorUsername}</p>
        )}
        <div className="study-flashcard-wrap">
          {card ? (
            <>
              <button
                type="button"
                className="study-flashcard"
                onClick={() => setFlashcardFlipped((f) => !f)}
              >
                <p className="study-flashcard-label">{flashcardFlipped ? 'Back' : 'Front'}</p>
                <p className="study-flashcard-text">{flashcardFlipped ? card.back : card.front}</p>
              </button>
              <div className="study-flashcard-arrows">
                <button type="button" disabled={idx <= 0} onClick={() => { setFlashcardIndex(idx - 1); setFlashcardFlipped(false); }}>Prev</button>
                <button type="button" disabled={idx >= cards.length - 1} onClick={() => { setFlashcardIndex(idx + 1); setFlashcardFlipped(false); }}>Next</button>
              </div>
            </>
          ) : (
            <p>No cards in this set.</p>
          )}
        </div>
      </div>
    );
  }

  if (item.type === 'practice_test') {
    const questions = item.data?.questions || [];
    const total = questions.length;
    const idx = Math.min(testQuestionIndex, total);
    const q = idx < total ? questions[idx] : null;
    const showScore = total === 0 || (testScore.total > 0 && idx >= total);
    const options = q ? (q.choices || q.options || []) : [];
    const correctIndex = q && typeof q.answerIndex === 'number' ? q.answerIndex : q?.correctIndex;
    return (
      <div className="study-viewer">
        <div className="study-viewer-header">
          <button type="button" className="study-viewer-back" onClick={() => { onClose(); setTestQuestionIndex(0); setTestSelected(null); setTestShowResult(false); setTestScore({ correct: 0, total: 0 }); }}>← Back</button>
          <span className="study-viewer-title">{item.title}</span>
          {!showScore && total > 0 && <span className="study-viewer-nav">{Math.min(idx + 1, total)} / {total}</span>}
        </div>
        {item.creatorUsername && (
          <p className="study-viewer-by">by {item.creatorUsername}</p>
        )}
        <div className="study-practice-test">
          {showScore ? (
            <div className="study-test-score">
              <h3>Results</h3>
              {total > 0 ? (
                <>
                  <p className="study-test-score-text">
                    You got {testScore.correct} out of {testScore.total} correct.
                  </p>
                  <p className="study-test-score-text">
                    Score:{' '}
                    {testScore.total > 0
                      ? Math.round((testScore.correct / testScore.total) * 100)
                      : 0}
                    %
                  </p>
                  <div className="study-practice-actions">
                    <button
                      type="button"
                      className="study-btn study-btn-primary"
                      onClick={() => {
                        setTestQuestionIndex(0);
                        setTestSelected(null);
                        setTestShowResult(false);
                        setTestScore({ correct: 0, total: 0 });
                      }}
                    >
                      Restart test
                    </button>
                    <button
                      type="button"
                      className="study-btn study-btn-secondary"
                      onClick={() => {
                        onClose();
                        setTestQuestionIndex(0);
                        setTestSelected(null);
                        setTestShowResult(false);
                        setTestScore({ correct: 0, total: 0 });
                      }}
                    >
                      Exit
                    </button>
                  </div>
                </>
              ) : (
                <p className="study-test-score-text">No questions in this test.</p>
              )}
            </div>
          ) : q ? (
            <>
              <p className="study-test-question">{q.question}</p>
              <div className="study-test-options">
                {options.map((opt, i) => {
                  const selected = testSelected === i;
                  const correct = typeof correctIndex === 'number' && correctIndex === i;
                  const showRight = testShowResult && correct;
                  const showWrong = testShowResult && selected && !correct;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`study-test-option ${showRight ? 'study-test-option--correct' : ''} ${showWrong ? 'study-test-option--wrong' : ''}`}
                      onClick={() => {
                        if (testShowResult) return;
                        setTestSelected(i);
                        setTestShowResult(true);
                        setTestScore((s) => ({
                          correct: s.correct + (typeof correctIndex === 'number' && i === correctIndex ? 1 : 0),
                          total: s.total + 1,
                        }));
                      }}
                      disabled={testShowResult}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {testShowResult && (
                <button type="button" className="study-btn study-btn-primary study-test-next" onClick={() => { setTestQuestionIndex(idx + 1); setTestSelected(null); setTestShowResult(false); }}>{idx + 1 >= total ? 'See results' : 'Next question'}</button>
              )}
            </>
          ) : (
            <p>No questions in this test.</p>
          )}
        </div>
      </div>
    );
  }

  // Study guide
  const sections = item.data?.sections || [];
  return (
    <div className="study-viewer">
      <div className="study-viewer-header">
        <button type="button" className="study-viewer-back" onClick={onClose}>← Back</button>
        <span className="study-viewer-title">{item.title}</span>
      </div>
      {item.creatorUsername && (
        <p className="study-viewer-by">by {item.creatorUsername}</p>
      )}
      <div className="study-guide-view">
        {sections.map((s, i) => (
          <section key={i} className="study-guide-section">
            <h3 className="study-guide-section-title">{s.title}</h3>
            <div className="study-guide-section-content">{s.content}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
