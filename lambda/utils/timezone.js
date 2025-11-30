/**
 * Converts a Date object to Mountain Time (MT) and returns formatted date and time strings
 * @param {Date} date - The date to convert
 * @returns {Object} Object with date (YYYY-MM-DD) and time (HH:MM) in Mountain Time
 */
function convertToMountainTime(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided');
  }

  // Create a formatter for Mountain Time
  const options = {
    timeZone: 'America/Denver', // Mountain Time
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(date);

  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  const hour = parts.find(p => p.type === 'hour').value;
  const minute = parts.find(p => p.type === 'minute').value;

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`
  };
}

module.exports = {
  convertToMountainTime
};

