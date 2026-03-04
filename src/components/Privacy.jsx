import '../css/App.css';

export default function Privacy() {
  return (
    <div className="static-page">
      <h1 className="static-page-title">Privacy Policy</h1>
      <p className="static-page-updated">Last updated: January 1, 2026</p>

      <section className="static-page-section">
        <h2>1. Overview</h2>
        <p>
          This Privacy Policy explains how MindStudy AI collects, uses, and protects information when
          you use the app. This is a mock policy for development and testing purposes only.
        </p>
      </section>

      <section className="static-page-section">
        <h2>2. Information we collect</h2>
        <ul>
          <li>Account information such as email and username.</li>
          <li>Study data you choose to save (plans, study items, public library contributions).</li>
          <li>Basic usage information, such as how often you use certain features.</li>
        </ul>
      </section>

      <section className="static-page-section">
        <h2>3. How we use information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide and improve the study planning and study tools in the app.</li>
          <li>Maintain your account and sync your data across sessions.</li>
          <li>Understand feature usage at an aggregate level.</li>
        </ul>
      </section>

      <section className="static-page-section">
        <h2>4. Data sharing</h2>
        <p>
          We do not sell your personal data. We may use third-party services (such as hosting or
          analytics providers) to operate the app, and they may process data on our behalf under
          appropriate agreements.
        </p>
      </section>

      <section className="static-page-section">
        <h2>5. Public content</h2>
        <p>
          When you choose to publish study items to the Public Library, those items may be visible to
          other users. Avoid including sensitive personal information in public items.
        </p>
      </section>

      <section className="static-page-section">
        <h2>6. Your choices</h2>
        <p>
          You can update or delete your study data from within the app. You may also delete your
          account from the account settings section, or by contacting us.
        </p>
      </section>

      <section className="static-page-section">
        <h2>7. Contact</h2>
        <p>
          For questions about this Privacy Policy, contact support@mindstudyai.com.
        </p>
      </section>
    </div>
  );
}

