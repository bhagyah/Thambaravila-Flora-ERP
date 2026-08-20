const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        searchDir(filePath);
      }
    } else if (filePath.endsWith('.tsx')) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('fetch') && content.includes('useEffect')) {
        if (content.includes('useEffect(() => {') && content.includes('}, [])')) {
          console.log(`Potential session race condition in: ${filePath}`);
        }
      }
    }
  }
}

searchDir('./app');
