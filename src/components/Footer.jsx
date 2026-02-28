import '../css/Footer.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="app-footer-brand">
          <span className="app-footer-logo" aria-hidden>MS</span>
          <span className="app-footer-name">Mind Study</span>
        </div>
        <p className="app-footer-tagline">AI-powered study planning for your goals.</p>
        <p className="app-footer-copy">© {year} Mind Study. All rights reserved.</p>
      </div>
    </footer>
  );
}
