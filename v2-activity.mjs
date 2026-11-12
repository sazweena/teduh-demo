// Fictional first names are used only for clearly labelled illustrative activity.
export const activityNames = ['Aina', 'Hakim', 'Farah', 'Daniel', 'Nadia', 'Amir', 'Mei Ling', 'Sofia'];

export const activityIssues = {
  hot: 'heat',
  cross: 'an unsafe crossing',
  broken_path: 'a damaged footpath',
};

export function nextActivity(concerns, random = Math.random) {
  if (!concerns.length) return null;
  return {
    name: activityNames[Math.floor(random() * activityNames.length)],
    concern: concerns[Math.floor(random() * concerns.length)],
  };
}
