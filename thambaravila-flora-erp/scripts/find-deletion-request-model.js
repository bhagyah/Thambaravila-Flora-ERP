const fs = require('fs');
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const lines = schema.split('\n');
let inside = false;
lines.forEach((line, idx) => {
  if (line.includes('model BookingDeletionRequest')) inside = true;
  if (inside) {
    console.log(`${idx + 1}: ${line}`);
    if (line.includes('}')) inside = false;
  }
});
