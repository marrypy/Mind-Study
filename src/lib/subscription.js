/**
 * Returns the current user's subscription tier.
 * @param {{ email?: string } | null} user - Auth user object
 * @returns {'free' | 'pro'}
 */
export function getSubscriptionTier(user) {
  if (!user?.email) return 'free';
  const proEmails = ['marry.kassa@yale.edu'];
  return proEmails.includes(user.email.toLowerCase()) ? 'pro' : 'free';
}
