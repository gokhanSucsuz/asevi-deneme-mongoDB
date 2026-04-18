import * as fs from 'fs';
import * as path from 'path';

function walk(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx')) results.push(file);
        }
    });
    return results;
}

const files = walk('./app/admin');
let changedAny = false;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Split by lines to only affect <td> and <th> lines safely
    const lines = content.split('\n');
    let modified = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('whitespace-nowrap') && (lines[i].includes('<td') || lines[i].includes('<th'))) {
            lines[i] = lines[i].replace('whitespace-nowrap', 'whitespace-normal break-words min-w-[120px]');
            modified = true;
        }
    }
    
    if (modified) {
        fs.writeFileSync(file, lines.join('\n'), 'utf8');
        console.log('Fixed:', file);
        changedAny = true;
    }
});

if (!changedAny) console.log('No files needed change.');
