const fs = require('fs');
const path = require('path');

const galleryPath = path.join(__dirname, 'gallery');
const result = {};

fs.readdirSync(galleryPath).forEach(folder = {
  const fullPath = path.join(galleryPath, folder);
  if (fs.statSync(fullPath).isDirectory()) {
    result[folder] = fs.readdirSync(fullPath)
      .filter(f = .(jpgpngjpeg)$i.test(f))
      .map(f = `gallery${folder}${f}`);
  }
});

fs.writeFileSync('gallery.json', JSON.stringify(result, null, 2));
console.log('gallery.json generated');