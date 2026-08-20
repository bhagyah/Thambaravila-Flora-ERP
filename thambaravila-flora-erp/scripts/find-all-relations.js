const fs = require('fs');
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const lines = schema.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Booking') || line.includes('Customer')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
