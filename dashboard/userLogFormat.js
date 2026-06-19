/** Browser-side helpers — mirrors dashboard/userLogFilter.js formatProgressLog */
(function (global) {
  function formatProgressLog(testType, progress) {
    if (!progress || !progress.action) return '';

    const phone = progress.phoneNumber || progress.number || '';
    const pct =
      progress.percentage != null ? ' (' + Math.round(progress.percentage) + '%)' : '';

    const icons = { calling: '📞', sms: '💬', data: '', 'sim-latch': '📡' };
    const icon = icons[testType] || '📊';

    return icon + ' ' + progress.action + (phone ? ' — ' + phone : '') + pct;
  }

  global.UserLogFormat = { formatProgressLog };
})(typeof window !== 'undefined' ? window : global);
