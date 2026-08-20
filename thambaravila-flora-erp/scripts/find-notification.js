const fs = require('fs');
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const lines = schema.split('\n');
let insideNotif = false;
lines.forEach((line, idx) => {
  if (line.includes('model Notification')) insideNotif = true;
  if (insideNotif) {
    console.log(`${idx + 1}: ${line}`);
    if (line.includes('}')) insideNotif = false;
  }
});
