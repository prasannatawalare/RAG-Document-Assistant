import axios from 'axios';

async function checkFrontendBuild() {
  console.log('Checking built files...');
  const fs = await import('fs');
  const path = await import('path');
  
  const distDir = path.join(process.cwd(), 'RDA-frontend', 'dist', 'assets');
  if (!fs.existsSync(distDir)) {
    console.log('Dist directory not found, skipping deep check.');
    return;
  }
  
  const files = fs.readdirSync(distDir);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  
  for (const file of jsFiles) {
    const content = fs.readFileSync(path.join(distDir, file), 'utf8');
    if (content.includes('localhost:5000')) {
      console.log(`[!] Found hardcoded localhost:5000 in ${file}`);
    }
    if (content.includes('/api')) {
      console.log(`[i] Found /api reference in ${file}`);
    }
  }
  console.log('Check complete.');
}

checkFrontendBuild();
