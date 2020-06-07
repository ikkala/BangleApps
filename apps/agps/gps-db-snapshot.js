const storage = require('Storage');

let initNum = 0;

function start() {
  print('agps', initNum);
  initNum += 1;
  Bangle.removeListener("GPS", fixListener);
  const settings = getSettings();
  if (settings.gpsSnapNavDb) {
    Bangle.on('GPS', fixListener);
  }
}

let nextSnapshotTs = 0;
let snapshotting = false;

let debug = 0;

function fixListener(fix) {
  const now = Date.now();

  if (!fix.fix && debug === 0) {
    print('now:', now, 'nextSnapshotTs:', nextSnapshotTs, 'snapshotting:', snapshotting, 'satellites:', fix.satellites, 'time:', fix.time);
  }
  debug += 1;
  if (debug >= 5) debug = 0;

  if (!snapshotting && fix.fix && now >= nextSnapshotTs) {
    snapshotting = true;
    setNextSnapshotTs();
    getSnapshot(() => {
      snapshotting = false;
    });
  }
}

function setNextSnapshotTs() {
  const settings = getSettings();
  const delay = 60 * 60 * 1000 / (settings.gpsSnapNavDbFreq || 1);
  const now = Date.now();
  nextSnapshotTs = now + delay;
}

const settingsFile = 'agps.json';

function getSettings() {
  return storage.readJSON(settingsFile, 1) || {};
}

function updateSetting(updatedSettings) {
  const settings = getSettings();
  Object.keys(updatedSettings).forEach(settingName => {
    settings[settingName] = updatedSettings[settingName];
  });
  storage.writeJSON(settingsFile, settings);
}

function getSnapshot(doneCb) {
  const navigationDbRows = [];
  let done = false;
  function cb(d) {
    if (d[0] === "$") return;
    // const debug = E.toUint8Array(d);
    // print('DXX:', d.length, debug);
    if (!done) { 
      if (d.startsWith("\xB5\x62\x13\x80")) {
        // UBX-MGA-DBD Navigation database dump entry
        navigationDbRows.push(d);
        // print('DBD');
      } else if (d.startsWith("\xB5\x62\x13\x60\x08\x00\x01\x00\x00\x80") && d.length === 16) {
        // UBX_MGA_ACK_DATA0 Multiple GNSS acknowledge message
        done = true;
        Bangle.removeListener("GPS-raw", cb);
        clearTimeout(giveupTimer);
        setTimeout(() => {
          print("DATA0");
          const uints = E.toUint8Array(d);
          const ackMsgClaimedRowCount =
            uints[10] +
            (uints[11] << 8) +
            (uints[12] << 16) +
            (uints[13] << 24);
          const receivedRowCount = navigationDbRows.length;
          print('ackMsgClaimedRowCount:', ackMsgClaimedRowCount);
          print("receivedRowCount:", );
          // TODO: Number should have exact match but currently not able to get them match,
          // so cheating a bit:
          const now = Date.now();
          if (receivedRowCount === ackMsgClaimedRowCount) {
            // Store with \xB5\x62\x13\x80 prefix and checksums
            storage.write("navdb", navigationDbRows.join(''));
            /*const f = storage.open("navdb", "w");
            for (const navigationDbRow of navigationDbRows) {
              f.write(navigationDbRow);
            }*/
            updateSetting({
              attamptTs: now,
              snapshotTs: now,
              ackMsgClaimedRowCount: ackMsgClaimedRowCount,
              receivedRowCount: receivedRowCount,
            });
            /*setTimeout(() => {
              const s = storage.read("navdb");
              print('s:', s.length);
            }, 1000);*/
            doneCb();
          } else {
            updateSetting({
              attamptTs: now,
              ackMsgClaimedRowCount: ackMsgClaimedRowCount,
              receivedRowCount: receivedRowCount,
            });
            doneCb();
          }
        }, 500);
      }
    }
  }
  Bangle.on('GPS-raw', cb);
  activateNavigationDbAck();
  setTimeout(() => {
    writeUBXcmd([0x13, 0x80, 0, 0]); // UBX-MGA-DBD Poll the navigation database
  }, 1000);
  const giveupTimer = setTimeout(() => {
    if (!done) {
      // Give up trying if it takes too long
      done = true;
      Bangle.removeListener("GPS-raw", cb);
      print("Giving up on waiting nav db data");
      doneCb();
    }
  }, 20000);
}

function activateNavigationDbAck() {
  // UBX-CFG-NAVX5 Navigation engine expert settings
  writeUBXcmd([0x06, 0x23,
    0x28,
    0x0,
    0x2,
    0x0,
    0x0,
    0x44,
    0x0,
    0x0,
    0x0,
    0x0,
    0x3,
    0x2,
    0x3,
    0x20,
    0x6,
    0x0,
    0x0,
    0x1,
    0x0,
    0x1,
    0x4b,
    0x7,
    0x0,
    0x1,
    0x0,
    0x0,
    0x1,
    0x1,
    0x0,
    0x0,
    0x0,
    0x64,
    0x64,
    0x0,
    0x0,
    0x1,
    0x11,
    0x0,
    0x0,
    0x0,
    0x0,
    0x0
  ]);
}

function restoreSnapshot(doneCb) {
  function cb(d) {
    if (d[0] === '$') return;
    print(d);
    // UBX_MGA_ACK_DATA0 Multiple GNSS acknowledge message
    if (d.startsWith("\xB5\x62\x13\x60\x08\x00") && d.length === 16 && d[9] == 0x80) {
      print('UBX_MGA_ACK_DATA0:', d[10], d[11], d[12], d[13]);
    }
  }
  Bangle.on('GPS-raw', cb);
  activateNavigationDbAck();
  const ndb = new Uint8Array(storage.readArrayBuffer("navdb"));
  let count = 0;
  let i = 0;
  while (i < ndb.length) {
    // TODO: Header, etc. sanity checks
    const dumpMsgStart = i;
    i += 2; // Header
    i += 2; // Class and ID
    const len = ndb[i] + (ndb[i + 1] << 8);
    i += 2;
    i += len;
    i += 2; // Checksums
    const dumpMsgEnd = i;
    print(dumpMsgStart, dumpMsgEnd);
    Serial1.write(ndb.slice(dumpMsgStart, dumpMsgEnd));
    count += 1;
  }
  print('count:', count);
  setTimeout(() => {
    Bangle.removeListener("GPS-raw", cb);
    doneCb();
  }, 500);
}

function coldStartUblox(doneCb) {
  // Cold start, hardware reset  UBX-CFG-RST
  writeUBXcmd([0x06, 0x04, 4, 0, 0xFF, 0xFF, 0, 0]); 
  setTimeout(() => {
    doneCb();
  }, 500);
}

function writeUBXcmd(cmd) {
  var d = [0xB5,0x62];
  d = d.concat(cmd);
  var a=0,b=0;
  for (var i=2;i<d.length;i++) {
    a += d[i];
    b += a;
  }
  d.push(a,b);
  Serial1.write(d);
}

exports = {
  start: start,
  restoreSnapshot: restoreSnapshot,
  coldStartUblox: coldStartUblox,
  getSettings: getSettings,
  updateSetting: updateSetting,
};
