export function notifyUser(userId: string, type: string, payload: { eventId: string } | { matchId: string }) {
  console.log('CampusConnect notification', userId, type, payload);
}
