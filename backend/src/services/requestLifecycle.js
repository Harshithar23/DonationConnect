const adminDecisionTransitions = {
  pending: ['approved', 'rejected', 'closed'],
  approved: ['closed']
};

export function canAdminReviewRequest(currentStatus, decision) {
  return adminDecisionTransitions[currentStatus]?.includes(decision) ?? false;
}
