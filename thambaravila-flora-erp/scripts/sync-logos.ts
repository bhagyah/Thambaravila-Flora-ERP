import * as fs from 'fs';
import * as path from 'path';

const publicDir = path.resolve(__dirname, '../public');
const logoPng = fs.readFileSync(path.join(publicDir, 'logo.png')).toString('base64');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
  <image href="data:image/png;base64,${logoPng}" width="500" height="500"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'logo.svg'), svgContent);
fs.writeFileSync(path.join(publicDir, 'logo-white.svg'), svgContent);
console.log('✅ Generated logo.svg and logo-white.svg from uploaded image');
