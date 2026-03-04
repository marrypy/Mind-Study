import '../css/App.css';

export default function Terms() {
  return (
    <div className="static-page">
      <h1 className="static-page-title">Terms &amp; Conditions</h1>
      <p className="static-page-updated">Last updated: January 1, 2026</p>

      <section className="static-page-section">
        <h2>1. Overview</h2>
        <p>
          These Terms &amp; Conditions (&quot;Terms&quot;) govern your use of MindStudy AI. By
          creating an account or using the app, you agree to be bound by these Terms.
        </p>
      </section>

      <section className="static-page-section">
        <h2>2. Not medical or legal advice</h2>
        <p>
          MindStudy AI provides study planning and productivity assistance only. It does not provide
          medical, legal, or therapeutic advice. Always consult a qualified professional for those topics.
        </p>
      </section>

      <section className="static-page-section">
        <h2>3. Your responsibilities</h2>
        <ul>
          <li>Provide accurate information when using the app.</li>
          <li>Use the app in a lawful manner and for personal, non-commercial use.</li>
          <li>Keep your account credentials secure.</li>
        </ul>
      </section>

      <section className="static-page-section">
        <h2>4. Content and usage limits</h2>
        <p>
          We may set reasonable limits on usage (such as the number of study items or chat sessions)
          to ensure a reliable experience for all users. We may update these limits over time.
        </p>
      </section>

      <section className="static-page-section">
        <h2>5. Changes to the service</h2>
        <p>
          We may update or change features of MindStudy AI from time to time. We will try to avoid
          interruptions, but we cannot guarantee the service will always be available.
        </p>
      </section>

      <section className="static-page-section">
        <h2>6. Termination</h2>
        <p>
          We may suspend or terminate accounts that violate these Terms or abuse the service. You can
          also stop using the app at any time.
        </p>
      </section>

      <section className="static-page-section">
        <h2>7. Contact</h2>
        <p>
          If you have questions about these Terms, you can contact us at support@mindstudyai.com.
        </p>
      </section>
    </div>
  );
}

