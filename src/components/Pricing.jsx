import React, { useState } from 'react';
import '../css/Landing.css';

export default function Pricing({ onBack, isLoggedIn, isSubscribed, onSignUpClick }) {
  const [billing, setBilling] = useState('monthly'); // 'monthly' | 'annual'

  const isMonthly = billing === 'monthly';
  const proPrice = isMonthly ? '$10' : '$100';
  const proCycle = isMonthly ? '/month' : '/year';

  return (
    <div
      className="landing landing--guest"
      style={{ paddingTop: '5rem', paddingBottom: '3rem' }}
    >
      {onBack && (
        <div className="pricing-back-wrap">
          <button type="button" className="pricing-back-btn" onClick={onBack}>
            ← Back
          </button>
        </div>
      )}
      <section
        className="landing-section landing-section-pricing-page landing-in-view"
        aria-labelledby="pricing-heading"
      >
        <h1 id="pricing-heading" className="landing-section-title">
          Pricing
        </h1>
        <p className="landing-pricing-intro">
          Start free. Upgrade to Pro when MindStudy AI becomes a core part of your routine.
        </p>

        <div className="landing-pricing-toggle">
          <button
            type="button"
            className={`landing-pricing-toggle-btn ${
              isMonthly ? 'landing-pricing-toggle-btn--active' : ''
            }`}
            onClick={() => setBilling('monthly')}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`landing-pricing-toggle-btn ${
              !isMonthly ? 'landing-pricing-toggle-btn--active' : ''
            }`}
            onClick={() => setBilling('annual')}
          >
            Annually
          </button>
        </div>

        <div className="landing-pricing-grid">
          <div className="landing-pricing-card landing-pricing-card--free">
            <h3 className="landing-pricing-name">Free</h3>
            <p className="landing-pricing-price">
              $0
              <span className="landing-pricing-cycle">/month</span>
            </p>
            <ul className="landing-pricing-list">
              <li>Weekly study plans</li>
              <li>Timeline view of your week</li>
              <li>5 chat sessions per week</li>
              <li>5 study items per week</li>
              <li>Sync across devices</li>
              <li>Ad-free</li>
            </ul>
          </div>

          <div className="landing-pricing-card landing-pricing-card--pro">
            <h3 className="landing-pricing-name">Pro</h3>
            <p className="landing-pricing-price">
              {proPrice}
              <span className="landing-pricing-cycle">{proCycle}</span>
            </p>
            <ul className="landing-pricing-list">
              <li>Everything in Free, plus:</li>
              <li>Unlimited study items</li>
              <li>Unlimited chat sessions</li>
              <li>Test-based timelines from today to exam day</li>
            </ul>
          </div>
        </div>

        <div className="landing-pricing-cta">
          {isLoggedIn ? (
            isSubscribed ? (
              <button type="button" className="pricing-cta-btn pricing-cta-btn--subscribed" disabled>
                Subscribed
              </button>
            ) : (
              <button type="button" className="pricing-cta-btn pricing-cta-btn--primary">
                Subscribe
              </button>
            )
          ) : (
            <button
              type="button"
              className="pricing-cta-btn pricing-cta-btn--primary"
              onClick={onSignUpClick}
            >
              Sign Up to Subscribe
            </button>
          )}
        </div>
      </section>
    </div>
  );
}


