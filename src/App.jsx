import { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import AuthModal from './components/AuthModal.jsx';
import Landing from './components/Landing.jsx';
import OnboardingWizard from './components/OnboardingWizard.jsx';
import StudyPlan from './components/StudyPlan.jsx';
import PlanList from './components/PlanList.jsx';
import Study from './components/Study.jsx';
import Sidebar from './components/Sidebar.jsx';
import Account from './components/Account.jsx';
import Pomodoro from './components/Pomodoro.jsx';
import Footer from './components/Footer.jsx';
import ChatBot from './components/ChatBot.jsx';
import { generatePlan } from './lib/generatePlan.js';
import { generateStudyPlanWithAI } from './lib/minimax.js';
import { saveStudyPlan, getLatestStudyPlan, getWeekOfMondayLabel } from './lib/studyPlans.js';
import { addRecentlyOpened } from './lib/recentStorage.js';
import './css/App.css';

function AppContent() {
  const { user, isLoggedIn, signOut } = useAuth();
  const [view, setView] = useState('landing');
  const [plan, setPlan] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');
  const [planLoading, setPlanLoading] = useState(false);
  const [cameFromPlanList, setCameFromPlanList] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);

  // When logged in and on plan view with no plan (and not from list), try to load latest saved plan
  useEffect(() => {
    if (!isLoggedIn || view !== 'plan') return;
    if (plan) return; // already have a plan in state
    if (cameFromPlanList) return;
    setPlanLoading(true);
    getLatestStudyPlan()
      .then((row) => {
        const p = row?.plan;
        if (!p) return;
        const hasContent =
          (p.technique && p.technique.trim()) ||
          (p.considerations && p.considerations.length > 0) ||
          (p.weeklyTimeline && p.weeklyTimeline.length > 0) ||
          (p.studyBlocks && p.studyBlocks.length > 0);
        if (hasContent) setPlan(p);
      })
      .catch(() => {})
      .finally(() => setPlanLoading(false));
  }, [isLoggedIn, view, cameFromPlanList]);

  function handleGetStarted() {
    setView('form');
  }

  function handleFormBack() {
    setView('landing');
  }

  async function handleSubmit(context) {
    setPlanError(null);
    setSaveError(null);
    setIsGenerating(true);
    try {
      const aiPlan = await generateStudyPlanWithAI(context);
      setPlan(aiPlan);
      setCameFromPlanList(false);
      if (user) {
        try {
          await saveStudyPlan(aiPlan, context);
        } catch (err) {
          console.error('Save plan failed:', err);
          setSaveError(err.message || 'Could not save plan to your account.');
        }
      }
      setView('plan');
    } catch (err) {
      setPlanError(err.message || 'Failed to generate plan');
      const fallbackPlan = generatePlan(context);
      setPlan(fallbackPlan);
      setCameFromPlanList(false);
      if (user) {
        try {
          await saveStudyPlan(fallbackPlan, context);
        } catch (saveErr) {
          console.error('Save plan failed:', saveErr);
          setSaveError(saveErr.message || 'Could not save plan to your account.');
        }
      }
      setView('plan');
    } finally {
      setIsGenerating(false);
    }
  }

  function handlePlanBack() {
    if (cameFromPlanList) {
      setView('plan-list');
      setCameFromPlanList(false);
    } else {
      setView('form');
    }
  }

  function handleSelectPlanFromList(row) {
    setPlan(row.plan);
    setCameFromPlanList(true);
    setView('plan');
    if (user?.id && row?.created_at) {
      addRecentlyOpened(user.id, 'plan', row.id, getWeekOfMondayLabel(row.created_at), row.plan);
    }
  }

  function handleGoToStudy() {
    setView('study');
    setSelectedFolderId(null);
  }

  function handleGoToFolder(folder) {
    setView('study');
    setSelectedFolderId(folder.id);
    if (user?.id) addRecentlyOpened(user.id, 'folder', folder.id, folder.name);
  }

  function handleGoToPlan(row) {
    setPlan(row.plan);
    setCameFromPlanList(true);
    setView('plan');
    if (user?.id) addRecentlyOpened(user.id, 'plan', row.id, getWeekOfMondayLabel(row.created_at), row.plan);
  }

  function handleGoToRecent(item) {
    if (item.type === 'folder') {
      setView('study');
      setSelectedFolderId(item.id);
    } else if (item.type === 'plan' && item.plan) {
      setPlan(item.plan);
      setCameFromPlanList(true);
      setView('plan');
    }
  }

  function openSignUp() {
    setAuthModalTab('signup');
    setAuthModalOpen(true);
  }

  function openLogIn() {
    setAuthModalTab('login');
    setAuthModalOpen(true);
  }

  return (
    <div className="app">
      <header className="app-header app-header--full">
        <div className="header-inner">
          <button
            type="button"
            className="logo-wrap logo-button"
            onClick={() => setView('landing')}
            aria-label="Go to home"
          >
            <h1 className="logo">Mind Study</h1>
            <p className="logo-subtitle">AI-Powered Study Planning</p>
          </button>
          <div className="header-actions">
            {isLoggedIn ? (
              <>
                <button type="button" className="btn-header btn-header--link" onClick={() => { setPlanError(null); setSaveError(null); setView('plan-list'); }}>
                  My plan
                </button>
                <button type="button" className="btn-header btn-header--link" onClick={handleGoToStudy}>
                  Study
                </button>
                <button type="button" className="btn-header btn-header--link" onClick={() => setView('pomodoro')}>
                  Timer
                </button>
                <button type="button" className="btn-header btn-header--link" onClick={() => setView('account')}>
                  Account
                </button>
                <button type="button" className="btn-header" onClick={() => signOut()}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-header" onClick={openSignUp}>
                  Sign up
                </button>
                <button type="button" className="btn-header btn-header--primary" onClick={openLogIn}>
                  Log in
                </button>
              </>
            )}
            {isLoggedIn && <ThemeToggle />}
          </div>
        </div>
      </header>

      <div className="app-body">
        {isLoggedIn && (
          <Sidebar
            onGoToStudy={handleGoToStudy}
            onGoToFolder={handleGoToFolder}
            onGoToPlan={handleGoToPlan}
            onGoToPlanList={() => setView('plan-list')}
            onGoToRecent={handleGoToRecent}
          />
        )}
        <main className="app-main">
          <div className="app-main-inner">
        {view === 'landing' && (
          <Landing
            onGetStarted={handleGetStarted}
            onGeneratePlan={() => setView('form')}
            onGenerateClassFolder={() => { setView('study'); setSelectedFolderId(null); }}
            onOpenFolder={(folder) => {
              setView('study');
              setSelectedFolderId(folder.id);
              if (user?.id) addRecentlyOpened(user.id, 'folder', folder.id, folder.name);
            }}
            onOpenPlan={(row) => {
              setPlan(row.plan);
              setCameFromPlanList(true);
              setView('plan');
              if (user?.id) addRecentlyOpened(user.id, 'plan', row.id, getWeekOfMondayLabel(row.created_at), row.plan);
            }}
          />
        )}
          {view === 'form' && (
            <OnboardingWizard
              onSubmit={handleSubmit}
              onBack={handleFormBack}
              isLoading={isGenerating}
              onOpenSignUp={() => { setAuthModalTab('signup'); setAuthModalOpen(true); }}
              onOpenLogIn={() => { setAuthModalTab('login'); setAuthModalOpen(true); }}
              isLoggedIn={isLoggedIn}
            />
          )}
        {view === 'plan-list' && (
          <PlanList
            onSelectPlan={handleSelectPlanFromList}
            onCreatePlan={() => setView('form')}
          />
        )}
        {view === 'account' && (
          <Account onBack={() => setView('landing')} />
        )}
        {view === 'pomodoro' && (
          <Pomodoro />
        )}
        {view === 'study' && (
          <Study
            selectedFolderId={selectedFolderId}
            onSelectFolderId={setSelectedFolderId}
            onAddRecent={(type, id, label, plan) => {
              if (user?.id) addRecentlyOpened(user.id, type, id, label, plan);
            }}
          />
        )}
        {view === 'plan' && (
          planLoading ? (
            <div className="plan-loading">Loading your plan…</div>
          ) : plan ? (
            <StudyPlan plan={plan} onBack={handlePlanBack} error={planError} saveError={saveError} />
          ) : (
            <div className="plan-empty">
              <p>You don’t have a saved plan yet.</p>
              <button type="button" className="btn-header btn-header--primary" onClick={() => setView('form')}>
                Create a plan
              </button>
            </div>
          )
        )}
          </div>
        </main>
      </div>

      <Footer />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultTab={authModalTab}
      />
      <ChatBot />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
