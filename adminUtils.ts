export const exportToCsv = (filename: string, headers: string[], rows: (string | number | undefined | null)[][]) => {
  const sanitize = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' +
    [headers.map(sanitize).join(','), ...rows.map(row => row.map(sanitize).join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const getDifficultyMultiplier = (diff?: string): number => {
  const d = (diff || 'intermediate').toLowerCase();
  if (d.includes('begin') || d.includes('easy')) return 100;
  if (d.includes('adv') || d.includes('hard') || d.includes('capstone')) return 200;
  return 150;
};

export const calculatePointsEarned = (score: number, diff?: string): number => {
  const max = getDifficultyMultiplier(diff);
  const clamped = Math.max(0, Math.min(100, score));
  return Math.round((clamped / 100) * max);
};
