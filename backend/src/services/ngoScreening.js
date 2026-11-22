/** Basic completeness and duplicate checks; admin review remains the final decision. */
export function screenNGO(input, existing = []) {
  let score = 0;
  const flags = [];
  if (!input.registrationNumber?.trim()) { score += 25; flags.push('Missing registration number'); }
  if (!input.documents?.some(document => document.kind === 'registration_certificate')) { score += 25; flags.push('Registration certificate not provided'); }
  if (!input.registeredAddress?.trim()) { score += 15; flags.push('Missing registered address'); }
  const normalize = value => value?.trim().toLowerCase();
  if (existing.some(item => normalize(item.registrationNumber) === normalize(input.registrationNumber) || normalize(item.legalName) === normalize(input.legalName))) {
    score += 35;
    flags.push('Possible duplicate registration details');
  }
  return {
    score: Math.min(score, 100),
    flags,
    disposition: score >= 40 ? 'manual_review_required' : 'standard_review_required',
    explanation: 'Basic completeness checks only. Admin review and authoritative verification are required.'
  };
}
