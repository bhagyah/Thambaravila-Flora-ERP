const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk('./app');
console.log(`Scanning ${files.length} files...`);

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('session') && !content.includes('useSession') && !content.includes('getServerSession') && !content.includes('interface') && !content.includes('type ')) {
    console.log(`POTENTIAL MISSING SESSION HOOK IN: ${f}`);
  }
});
