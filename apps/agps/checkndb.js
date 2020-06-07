const fs = require('fs');

const file = process.argv[2];
console.log('file:', file);

const ndb = fs.readFileSync(file);
let count = 0;
let i = 0;
while (i < ndb.length) {
  count += 1;
  console.log('count:', count);
  const header = ndb.readUInt16BE(i); i += 2;
  if (header !== 0xB562) {
    console.log('Nope', header.toString(16));
    process.exit(-1);
  }
  const classAndId = ndb.readUInt16BE(i); i += 2;
  if (classAndId !== 0x1380) {
    console.log('Nope', classAndId.toString(16));
    process.exit(-1);
  }
  let a = 0x13;
  let b = a;
  a += 0x80;
  b += a;
  let len = ndb.readUInt16LE(i); i += 2;
  console.log('len:', len.toString(16));
  a += len & 0xFF;
  b += a;
  a += (len >> 8) & 0xFF;
  b += a;
  while (len > 0) {
    const c = ndb.readUInt8(i); i += 1;
    a = (a + c) % 0x100;
    b = (b + a) % 0x100;
    len -= 1;
  }
  const ckA = ndb.readUInt8(i); i += 1;
  const ckB = ndb.readUInt8(i); i += 1;
  if (a !== ckA || b !== ckB) {
    console.log('ckA', ckA.toString(16), 'a', a.toString(16));
    console.log('ckB', ckB.toString(16), 'b', b.toString(16));
    process.exit(-1);
  }
  console.log('good', count);
}
