const fs = require('fs');
const path = require('path');

const files = [
  'app/admin/drivers/page.tsx',
  'app/admin/households/page.tsx',
  'app/admin/layout.tsx',
  'app/admin/leftover-food/page.tsx',
  'app/admin/logs/page.tsx',
  'app/admin/personnel/page.tsx',
  'app/admin/statistics/page.tsx',
  'app/admin/surveys/page.tsx',
  'app/admin/system/page.tsx',
  'app/admin/working-days/page.tsx'
];

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('import { safeFormat }')) {
    // Add import after other imports
    const lines = content.split('\n');
    let lastImportIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith('import ')) {
        lastImportIndex = i;
        break;
      }
    }
    if (lastImportIndex !== -1) {
      lines.splice(lastImportIndex + 1, 0, "import { safeFormat } from '@/lib/date-utils';");
      fs.writeFileSync(filePath, lines.join('\n'));
      console.log(`Updated ${file}`);
    }
  }
}

// Fix the 3 misspelled ones
const misspelledFiles = [
  'app/admin/bread-tracking/page.tsx',
  'app/driver/page.tsx',
  'app/api/reports/pdf/route.ts'
];
for (const file of misspelledFiles) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('@/lib/dateUtils')) {
    content = content.replace(/@\/lib\/dateUtils/g, "@/lib/date-utils");
    fs.writeFileSync(filePath, content);
    console.log(`Fixed typo in ${file}`);
  }
}
