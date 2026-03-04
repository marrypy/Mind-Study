import '../css/Footer.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="app-footer-left">
          <div className="app-footer-brand">
            <span className="app-footer-logo" aria-hidden>MS</span>
            <span className="app-footer-name">MindStudy AI</span>
          </div>
          <p className="app-footer-tagline">AI-powered study planning & studying for your goals.</p>
          <p className="app-footer-copy">© {year} MindStudy AI. All rights reserved.</p>
        </div>
        <div className="app-footer-right">
          <div className="app-footer-support">support@mindstudyai.com</div>
          <div className="app-footer-links">
            <a href="/terms" className="app-footer-link">Terms &amp; Conditions</a>
            <span className="app-footer-sep">•</span>
            <a href="/privacy" className="app-footer-link">Privacy Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
