const agps = require('agps.gps-db-snapshot.js');

const settings = agps.getSettings();

function displayTs(ts) {
  if (!ts) {
    return [];
  }
  const isoTs = new Date(ts).toISOString();
  return isoTs.substr(0, isoTs.length - 2).split('T');
}

g.clear(1);
g.setFont("6x8", 2);
var y = 8, h=16;
function printString(str) {
  g.drawString(str, 0, y += h);
}
printString("Snapshot DB: " + settings.gpsSnapNavDb);
printString("Frequency (1/h): " + settings.gpsSnapNavDbFreq);
y += h / 2;
printString("Last ts:");
displayTs(settings.snapshotTs).forEach(printString);
printString("AckMsg rows:   " + settings.ackMsgClaimedRowCount);
printString("Received rows: " + settings.receivedRowCount);
printString("Attampt ts:");
displayTs(settings.attamptTs).forEach(printString);

setWatch(() => {
  Bangle.setGPSPower(1);
  agps.coldStartUblox(() => {
    Bangle.setGPSPower(0);
  });
}, BTN1, { repeat: true });
setWatch(() => {
  Bangle.setGPSPower(1);
  agps.restoreSnapshot(() => {
    Bangle.setGPSPower(0);
  });
}, BTN2, { repeat: true });
