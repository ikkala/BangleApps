(function(back) {
  const agps = require('agps.gps-db-snapshot.js');
  const settings = agps.getSettings();
  const boolFormat = v => v ? "On" : "Off";
  E.showMenu({
    '': { 'title': 'GPS' },
    '< Back': back,
    'Snapshot DB': {
      value: settings.gpsSnapNavDb,
      format: boolFormat,
      onchange: () => {
        settings.gpsSnapNavDb = !settings.gpsSnapNavDb;
        agps.updateSetting({gpsSnapNavDb: settings.gpsSnapNavDb});
      }
    },
    'Frequency (1/h)': {
      value: settings.gpsSnapNavDbFreq || 1,
      min: 1,
      max: 61,
      step: 10,
      onchange: v => {
        settings.gpsSnapNavDbFreq = v || 1;
        agps.updateSetting({gpsSnapNavDbFreq: settings.gpsSnapNavDbFreq});
      }
    },
  });
});
