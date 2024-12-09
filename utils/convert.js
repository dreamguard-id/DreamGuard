const { DateTime } = require('luxon');

exports.convertTo24HourFormat = (timeString) => {
  return DateTime.fromFormat(timeString, 'hh:mm a').toFormat('HH:mm');
};

exports.calculateDuration = (startTime, endTime) => {
  const start = DateTime.fromFormat(startTime, 'HH:mm');
  const end = DateTime.fromFormat(endTime, 'HH:mm');

  let duration;
  if (end < start) {
    duration = end.plus({ days: 1 }).diff(start, ['hours', 'minutes']);
  } else {
    duration = end.diff(start, ['hours', 'minutes']);
  }

  const hours = Math.floor(duration.hours);
  const minutes = Math.floor(duration.minutes);

  return `${hours}h ${minutes}m`;
};

exports.calculateDurationDifference = (plannedDuration, actualDuration) => {
  const [plannedHours, plannedMinutes] = plannedDuration
    .split(' ')
    .map((part) => {
      return parseInt(part.replace(/[hm]/g, ''));
    });

  const [actualHours, actualMinutes] = actualDuration.split(' ').map((part) => {
    return parseInt(part.replace(/[hm]/g, ''));
  });

  const plannedTotalMinutes = (plannedHours || 0) * 60 + (plannedMinutes || 0);
  const actualTotalMinutes = (actualHours || 0) * 60 + (actualMinutes || 0);

  const diffMinutes = actualTotalMinutes - plannedTotalMinutes;

  const sign = diffMinutes >= 0 ? '+' : '-';

  const absHours = Math.floor(Math.abs(diffMinutes) / 60);
  const absMinutes = Math.abs(diffMinutes) % 60;

  return `${sign}${absHours}h ${absMinutes}m`;
};
