const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', 'src');
const libDir = path.resolve(__dirname, '..', 'lib');

fs.rmSync(libDir, { recursive: true, force: true });
fs.mkdirSync(libDir, { recursive: true });

for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.js')) {
    fs.copyFileSync(
      path.join(srcDir, entry.name),
      path.join(libDir, entry.name),
    );
  }
}
