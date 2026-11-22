const transitions = {
  goods: {
    pledged: ['pickup_scheduled', 'disputed', 'cancelled'],
    pickup_scheduled: ['collected', 'disputed', 'cancelled'],
    collected: ['received', 'disputed'],
    received: ['completed', 'disputed']
  }
};

export function canTransitionDonation(type, currentStatus, nextStatus) {
  return transitions[type]?.[currentStatus]?.includes(nextStatus) ?? false;
}

export function donationTrackingStatuses(type, currentStatus) {
  return transitions[type]?.[currentStatus] ?? [];
}
