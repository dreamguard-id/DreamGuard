const { DateTime } = require('luxon');

exports.convertTo24HourFormat = (timeString) => {
  return DateTime.fromFormat(timeString, 'hh:mm a').toFormat('HH:mm');
};

exports.calculateDuration = (startTime, endTime) => {
  const start = DateTime.fromFormat(startTime, 'hh:mm a');
  const end = DateTime.fromFormat(endTime, 'hh:mm a');

  const duration = end.diff(start, ['hours', 'minutes']);
  const hours = duration.hours;
  const minutes = duration.minutes;
  s;
  return `${hours}h ${minutes}m`;
};

exports.mapPredictionResult = (predictionResultId) => {
  const resultMapping = {
    0: 'No Sleep Disorder',
    1: 'Sleep Apnea',
    2: 'Sleep Insomnia',
    3: 'No Sleep Disorder', // ID 3 buat kondisi No Sleep Disorder + Tidur < 8 Jam
    4: 'No Sleep Disorder', // ID 4 buat kondisi No Sleep Disorder + Stress Level 8-10
    5: 'No Sleep Disorder', // ID 5 buat kondisi No Sleep Disorder + Tidur < 8 Jam + Stress Level 8-10
  };
  return resultMapping[predictionResultId] || 'Unknown Result';
};
