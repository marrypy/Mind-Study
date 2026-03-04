import { useState, useEffect, useRef } from 'react';
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
import Pricing from './components/Pricing.jsx';
import Terms from './components/Terms.jsx';
import Privacy from './components/Privacy.jsx';
import PublicLibrary from './components/PublicLibrary.jsx';
import AddToFolderModal from './components/AddToFolderModal.jsx';
import Footer from './components/Footer.jsx';
import ChatBot from './components/ChatBot.jsx';
import { generatePlan } from './lib/generatePlan.js';
import { generateStudyPlanWithAI } from './lib/openai.js';
import { saveStudyPlan, getLatestStudyPlan, getWeekOfMondayLabel, getPlanLabel } from './lib/studyPlans.js';
import { addRecentlyOpened } from './lib/recentStorage.js';
import { getSubscriptionTier } from './lib/subscription.js';
import './css/App.css';

function pathToView(pathname) {
  if (pathname === '/library' || pathname.startsWith('/library/')) return 'library';
  if (pathname === '/study' || pathname.startsWith('/study/')) return 'study';
  switch (pathname) {
    case '/':
    case '/landing':
      return 'landing';
    case '/form':
      return 'form';
    case '/plans':
      return 'plan-list';
    case '/plan':
      return 'plan';
    case '/account':
      return 'account';
    case '/timer':
      return 'pomodoro';
    case '/pricing':
      return 'pricing';
    case '/terms':
      return 'terms';
    case '/privacy':
      return 'privacy';
    default:
      return 'landing';
  }
}

function getLibraryItemIdFromPath(pathname) {
  if (!pathname || !pathname.startsWith('/library/')) return null;
  const rest = pathname.slice('/library/'.length);
  const id = rest.split('/')[0];
  return id || null;
}

function getStudyItemFromPath(pathname) {
  if (!pathname || !pathname.startsWith('/study/')) return { folderId: null, itemId: null };
  const parts = pathname.slice(1).split('/');
  if (parts[0] !== 'study' || parts.length !== 3) return { folderId: null, itemId: null };
  const folderId = decodeURIComponent(parts[1] || '');
  const itemId = decodeURIComponent(parts[2] || '');
  return folderId && itemId ? { folderId, itemId } : { folderId: null, itemId: null };
}

function viewToPath(view, opts = {}) {
  if (view === 'library') {
    return opts.libraryItemId ? `/library/${opts.libraryItemId}` : '/library';
  }
  if (view === 'study') {
    if (opts.studyFolderId && opts.studyItemId) {
      return `/study/${encodeURIComponent(opts.studyFolderId)}/${encodeURIComponent(opts.studyItemId)}`;
    }
    return '/study';
  }
  switch (view) {
    case 'landing':
      return '/';
    case 'form':
      return '/form';
    case 'plan-list':
      return '/plans';
    case 'plan':
      return '/plan';
    case 'account':
      return '/account';
    case 'pomodoro':
      return '/timer';
    case 'pricing':
      return '/pricing';
    case 'terms':
      return '/terms';
    case 'privacy':
      return '/privacy';
    default:
      return '/';
  }
}

function AppContent() {
  const { user, isLoggedIn, signOut } = useAuth();
  const [view, setView] = useState(() => {
    if (typeof window === 'undefined') return 'landing';
    return pathToView(window.location.pathname);
  });
  const [libraryItemId, setLibraryItemId] = useState(() => {
    if (typeof window === 'undefined') return null;
    return getLibraryItemIdFromPath(window.location.pathname);
  });
  const [studyFolderId, setStudyFolderId] = useState(() => {
    if (typeof window === 'undefined') return null;
    return getStudyItemFromPath(window.location.pathname).folderId;
  });
  const [studyItemId, setStudyItemId] = useState(() => {
    if (typeof window === 'undefined') return null;
    return getStudyItemFromPath(window.location.pathname).itemId;
  });
  const [plan, setPlan] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');
  const [planLoading, setPlanLoading] = useState(false);
  const [cameFromPlanList, setCameFromPlanList] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [addToFolderItem, setAddToFolderItem] = useState(null);
  const lastScrollY = useRef(0);

  const subscriptionTier = getSubscriptionTier(user);
  const isPro = subscriptionTier === 'pro';

  const effectiveView = isLoggedIn
    ? view
    : (view === 'pricing' || view === 'terms' || view === 'privacy'
        ? view
        : view === 'library'
          ? 'library'
          : 'landing');

  function goToLibrary() {
    navigate('library');
  }

  function navigate(nextView, opts = {}) {
    const nextLibId = opts.libraryItemId !== undefined ? opts.libraryItemId : (nextView === 'library' ? libraryItemId : null);
    const nextStudyFolder = opts.studyFolderId !== undefined ? opts.studyFolderId : (nextView === 'study' ? studyFolderId : null);
    const nextStudyItem = opts.studyItemId !== undefined ? opts.studyItemId : (nextView === 'study' ? studyItemId : null);
    setView(nextView);
    if (nextView === 'library') setLibraryItemId(nextLibId);
    if (nextView === 'study') {
      setStudyFolderId(nextStudyFolder);
      setStudyItemId(nextStudyItem);
    }
    if (typeof window !== 'undefined') {
      const nextPath = viewToPath(nextView, { libraryItemId: nextLibId, studyFolderId: nextStudyFolder, studyItemId: nextStudyItem });
      if (window.location.pathname !== nextPath) {
        window.history.pushState({ view: nextView, libraryItemId: nextLibId, studyFolderId: nextStudyFolder, studyItemId: nextStudyItem }, '', nextPath);
      }
    }
  }

  // Header: hide on scroll down, show on scroll up or at top
  useEffect(() => {
    const SCROLL_THRESHOLD = 60;
    function onScroll() {
      const y = window.scrollY ?? document.documentElement.scrollTop;
      if (y <= SCROLL_THRESHOLD) {
        setHeaderHidden(false);
      } else if (y > lastScrollY.current) {
        setHeaderHidden(true);
      } else {
        setHeaderHidden(false);
      }
      lastScrollY.current = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Sync view with browser back/forward
  useEffect(() => {
    function onPopState() {
      if (typeof window === 'undefined') return;
      const pathname = window.location.pathname;
      const v = pathToView(pathname);
      setView(v);
      if (v === 'library') setLibraryItemId(getLibraryItemIdFromPath(pathname));
      if (v === 'study') {
        const { folderId, itemId } = getStudyItemFromPath(pathname);
        setStudyFolderId(folderId);
        setStudyItemId(itemId);
      }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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
    if (!isLoggedIn) {
      setAuthModalTab('signup');
      setAuthModalOpen(true);
      return;
    }
    navigate('form');
  }

  function handleFormBack() {
    navigate('landing');
  }

  async function handleSubmit(context) {
    setPlanError(null);
    setSaveError(null);
    setIsGenerating(true);
    try {
      const aiPlan = await generateStudyPlanWithAI(context);
      aiPlan.planType = context.planType || 'weekly';
      if (context.planType === 'test' && (context.deadlines || '').trim()) {
        aiPlan.title = `${(context.deadlines).trim()} test`;
      }
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
      navigate('plan');
    } catch (err) {
      setPlanError(err.message || 'Failed to generate plan');
      const fallbackPlan = generatePlan(context);
      fallbackPlan.planType = context.planType || 'weekly';
      if (context.planType === 'test' && (context.deadlines || '').trim()) {
        fallbackPlan.title = `${(context.deadlines).trim()} test`;
      }
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
      navigate('plan');
    } finally {
      setIsGenerating(false);
    }
  }

  function handlePlanBack() {
    if (cameFromPlanList) {
      navigate('plan-list');
      setCameFromPlanList(false);
    } else {
      navigate('form');
    }
  }

  function handleSelectPlanFromList(row) {
    setPlan(row.plan);
    setCameFromPlanList(true);
    navigate('plan');
    if (user?.id && row?.created_at) {
      addRecentlyOpened(user.id, 'plan', row.id, getPlanLabel(row), row.plan);
    }
  }

  function handleGoToStudy() {
    navigate('study');
    setSelectedFolderId(null);
  }

  function handleGoToFolder(folder) {
    navigate('study');
    setSelectedFolderId(folder.id);
    if (user?.id) addRecentlyOpened(user.id, 'folder', folder.id, folder.name);
  }

  function handleGoToPlan(row) {
    setPlan(row.plan);
    setCameFromPlanList(true);
    navigate('plan');
    if (user?.id) addRecentlyOpened(user.id, 'plan', row.id, getPlanLabel(row), row.plan);
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
      <header className={`app-header app-header--full${headerHidden ? ' app-header--hidden' : ''}`}>
        <div className="header-inner">
          <button
            type="button"
            className="logo-wrap logo-button"
            onClick={() => navigate('landing')}
            aria-label="Go to home"
          >
            <h1 className="logo">MindStudy AI</h1>
            <p className="logo-subtitle">AI-Powered Study Planning</p>
          </button>
          <div className="header-search-wrap">
            <input
              type="search"
              className="header-search-input"
              placeholder="Search public library…"
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), goToLibrary())}
            />
            <button type="button" className="header-search-button" onClick={goToLibrary}>
              Search
            </button>
          </div>
          <div className="header-actions">
            {isLoggedIn ? (
              <>
                <button
                  type="button"
                  className="btn-header btn-header--link"
                  onClick={() => { setPlanError(null); setSaveError(null); navigate('plan-list'); }}
                >
                  Plans
                </button>
                <button type="button" className="btn-header btn-header--link" onClick={handleGoToStudy}>
                  Study
                </button>
                <button
                  type="button"
                  className="btn-header btn-header--link"
                  onClick={() => navigate('pricing')}
                >
                  Pricing
                </button>
                <button type="button" className="btn-header btn-header--link" onClick={() => navigate('pomodoro')}>
                  Timer
                </button>
                <button type="button" className="btn-header btn-header--link" onClick={() => navigate('account')}>
                  Account
                </button>
                <button type="button" className="btn-header" onClick={() => signOut()}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-header btn-header--link"
                  onClick={() => navigate('pricing')}
                >
                  Pricing
                </button>
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
            onGoToPlanList={() => navigate('plan-list')}
            onGoToRecent={handleGoToRecent}
          />
        )}
        <main className="app-main">
          <div className="app-main-inner">
        {effectiveView === 'landing' && (
          <Landing
            onGetStarted={handleGetStarted}
            onGeneratePlan={() => {
              if (!isLoggedIn) { setAuthModalTab('signup'); setAuthModalOpen(true); return; }
              navigate('form');
            }}
            onGenerateClassFolder={() => {
              if (!isLoggedIn) { setAuthModalTab('signup'); setAuthModalOpen(true); return; }
              navigate('study');
              setSelectedFolderId(null);
            }}
            onOpenFolder={(folder) => {
              if (!isLoggedIn) { setAuthModalTab('signup'); setAuthModalOpen(true); return; }
              navigate('study');
              setSelectedFolderId(folder.id);
              if (user?.id) addRecentlyOpened(user.id, 'folder', folder.id, folder.name);
            }}
            onOpenPlan={(row) => {
              if (!isLoggedIn) { setAuthModalTab('signup'); setAuthModalOpen(true); return; }
              setPlan(row.plan);
              setCameFromPlanList(true);
              navigate('plan');
              if (user?.id) addRecentlyOpened(user.id, 'plan', row.id, getPlanLabel(row), row.plan);
            }}
          />
        )}
          {effectiveView === 'form' && (
            <OnboardingWizard
              onSubmit={handleSubmit}
              onBack={handleFormBack}
              isLoading={isGenerating}
              onOpenSignUp={() => { setAuthModalTab('signup'); setAuthModalOpen(true); }}
              onOpenLogIn={() => { setAuthModalTab('login'); setAuthModalOpen(true); }}
              isLoggedIn={isLoggedIn}
              isPro={isPro}
              onOpenPricing={() => navigate('pricing')}
            />
          )}
        {effectiveView === 'plan-list' && (
          <PlanList
            onSelectPlan={handleSelectPlanFromList}
            onCreatePlan={() => navigate('form')}
          />
        )}
        {effectiveView === 'pricing' && (
          <Pricing
            onBack={() => navigate('landing')}
            isLoggedIn={isLoggedIn}
            isSubscribed={isPro}
            onSignUpClick={() => { setAuthModalTab('signup'); setAuthModalOpen(true); }}
          />
        )}
        {effectiveView === 'terms' && (
          <Terms />
        )}
        {effectiveView === 'privacy' && (
          <Privacy />
        )}
        {effectiveView === 'account' && (
          <Account
            onBack={() => navigate('landing')}
            onGoToPricing={() => navigate('pricing')}
          />
        )}
        {effectiveView === 'pomodoro' && (
          <Pomodoro />
        )}
        {effectiveView === 'study' && (
          <Study
            selectedFolderId={selectedFolderId}
            onSelectFolderId={setSelectedFolderId}
            initialViewingFolderId={studyFolderId}
            initialViewingItemId={studyItemId}
            onOpenItem={(folderId, itemId) => navigate('study', { studyFolderId: folderId, studyItemId: itemId })}
            onBackFromItem={() => navigate('study', { studyFolderId: null, studyItemId: null })}
            onAddRecent={(type, id, label, plan) => {
              if (user?.id) addRecentlyOpened(user.id, type, id, label, plan);
            }}
          />
        )}
        {effectiveView === 'plan' && (
          planLoading ? (
            <div className="plan-loading">Loading your plan…</div>
          ) : plan ? (
            <StudyPlan
              plan={plan}
              onBack={handlePlanBack}
              error={planError}
              saveError={saveError}
              librarySearch={librarySearch}
              onViewPublicItem={(item) => navigate('library', { libraryItemId: item.id })}
              onAddToFolder={(item) => setAddToFolderItem(item)}
            />
          ) : (
            <div className="plan-empty">
              <p>You don’t have a saved plan yet.</p>
              <button type="button" className="btn-header btn-header--primary" onClick={() => setView('form')}>
                Create a plan
              </button>
            </div>
          )
        )}
        {effectiveView === 'library' && (
          <PublicLibrary
            query={librarySearch}
            libraryItemId={libraryItemId}
            onNavigateToItem={(id) => navigate('library', { libraryItemId: id })}
            onBackToList={() => navigate('library', { libraryItemId: null })}
            onAddToFolder={(item) => setAddToFolderItem(item)}
            onOpenSignUp={() => { setAuthModalTab('signup'); setAuthModalOpen(true); }}
            isLoggedIn={isLoggedIn}
          />
        )}
          </div>
        </main>
      </div>

      {addToFolderItem && (
        <AddToFolderModal
          item={addToFolderItem}
          userId={user?.id}
          onClose={() => setAddToFolderItem(null)}
          onAdded={() => setAddToFolderItem(null)}
        />
      )}

      <Footer />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultTab={authModalTab}
      />
      <ChatBot
        isLoggedIn={isLoggedIn}
        onOpenSignUp={openSignUp}
        onOpenLogIn={openLogIn}
      />
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
