const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const ogs = require('open-graph-scraper');
const https = require('https');
const http = require('http');

const app = express();
const PORT = 3000;
const GALLERY_JSON_PATH = path.join(__dirname, 'gallery.json');
const CONFIG_PATH = path.join(__dirname, 'config.json');

// Middleware
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve static files from root

// simple admin password (in a real app, use environment variables and hashing)
const ADMIN_PASSWORD = 'admin';

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const category = req.body.category;
        const categoryPath = path.join(__dirname, 'gallery', category);

        // Create category directory if it doesn't exist
        if (!fs.existsSync(categoryPath)) {
            fs.mkdirSync(categoryPath, { recursive: true });
        }

        cb(null, categoryPath);
    },
    filename: function (req, file, cb) {
        // Keep original filename, but maybe prepend timestamp to avoid collisions
        // For simplicity, we'll keep original name but you might want to sanitize it
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// API: Login
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

// API: Upload Image
app.post('/api/upload', upload.single('image'), async (req, res) => {
    const { category, link } = req.body;
    let file = req.file;

    if (!category) {
        return res.status(400).json({ success: false, message: 'Missing category' });
    }
    
    // If no file but we have a link, try to fetch OG image
    if (!file && link) {
        try {
            const { result } = await ogs({ url: link });
            let imageUrl = null;
            if (result.ogImage && result.ogImage.length > 0) {
                imageUrl = result.ogImage[0].url;
            }
            
            if (imageUrl) {
                 // Determine filename and path
                 const ext = path.extname(imageUrl.split('?')[0]) || '.jpg';
                 const timestamp = Date.now();
                 const filename = `og_${timestamp}${ext}`;
                 const categoryPath = path.join(__dirname, 'gallery', category);
                 
                 // Ensure dir exists
                 if (!fs.existsSync(categoryPath)) {
                     fs.mkdirSync(categoryPath, { recursive: true });
                 }
                 
                 const filePath = path.join(categoryPath, filename);
                 const fileStream = fs.createWriteStream(filePath);
                 
                 await new Promise((resolve, reject) => {
                     const protocol = imageUrl.startsWith('https') ? https : http;
                     protocol.get(imageUrl, (response) => {
                         response.pipe(fileStream);
                         fileStream.on('finish', () => {
                             fileStream.close();
                             resolve();
                         });
                     }).on('error', (err) => {
                         fs.unlink(filePath, () => {}); // delete partial file
                         reject(err);
                     });
                 });
                 
                 // Mock file object for downstream logic
                 file = {
                     filename: filename,
                     originalname: result.ogTitle || '3D Case'
                 };
            } else {
                 return res.status(400).json({ success: false, message: 'Could not find OG image in link' });
            }
        } catch (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Failed to fetch OG data: ' + err.message });
        }
    }

    if (!file) {
        return res.status(400).json({ success: false, message: 'Missing file or link with OG image' });
    }

    // Update gallery.json
    fs.readFile(GALLERY_JSON_PATH, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Error reading database' });
        }

        let gallery = {};
        try {
            gallery = JSON.parse(data);
        } catch (e) {
            console.error(e);
            // If empty or invalid, start fresh
            gallery = {};
        }

        if (!gallery[category]) {
            gallery[category] = [];
        }

        // Construct the relative path to be stored in JSON
        // Note: We use forward slashes for web compatibility
        const relativePath = `gallery/${category}/${file.filename}`;
        
        // Construct entry based on presence of link
        let entry;
        if (link) {
            entry = {
                type: 'link',
                thumbnail: relativePath,
                url: link,
                title: file.originalname // optional
            };
        } else {
            entry = relativePath;
        }

        // Avoid duplicates (Check logic differs for object vs string)
        const exists = gallery[category].some(item => {
            const itemPath = typeof item === 'string' ? item : item.thumbnail;
            return itemPath === relativePath;
        });

        if (!exists) {
            gallery[category].push(entry);
        }

        fs.writeFile(GALLERY_JSON_PATH, JSON.stringify(gallery, null, 2), (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Error updating database' });
            }

            res.json({ success: true, filePath: relativePath });
        });
    });
});

// API: Get Categories
app.get('/api/categories', (req, res) => {
    fs.readFile(GALLERY_JSON_PATH, 'utf8', (err, data) => {
        if (err) return res.json([]);
        try {
            const gallery = JSON.parse(data);
            res.json(Object.keys(gallery));
        } catch (e) {
            res.json([]);
        }
    });
});

// API: Get Images in Category
app.get('/api/images', (req, res) => {
    const category = req.query.category;
    if (!category) return res.json([]);

    fs.readFile(GALLERY_JSON_PATH, 'utf8', (err, data) => {
        if (err) return res.json([]);
        try {
            const gallery = JSON.parse(data);
            res.json(gallery[category] || []);
        } catch (e) {
            res.json([]);
        }
    });
});

// API: Delete Image
app.delete('/api/image', (req, res) => {
    const { category, imagePath } = req.body; // imagePath e.g. "gallery/Modern/1.jpg"

    fs.readFile(GALLERY_JSON_PATH, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ success: false });

        let gallery = JSON.parse(data);
        if (gallery[category]) {
            // Remove from JSON
            gallery[category] = gallery[category].filter(item => {
                const itemPath = typeof item === 'string' ? item : item.thumbnail;
                return itemPath !== imagePath;
            });

            // Remove file
            const fullPath = path.join(__dirname, imagePath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }

            fs.writeFile(GALLERY_JSON_PATH, JSON.stringify(gallery, null, 2), (err) => {
                if (err) return res.status(500).json({ success: false });
                res.json({ success: true });
            });
        } else {
            res.status(404).json({ success: false, message: 'Category not found' });
        }
    });
});

// API: Delete Category
app.delete('/api/category', (req, res) => {
    const { category } = req.body;

    fs.readFile(GALLERY_JSON_PATH, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ success: false });

        let gallery = JSON.parse(data);
        if (gallery[category]) {
            // Remove from JSON
            delete gallery[category];

            // Remove folder
            const folderPath = path.join(__dirname, 'gallery', category);
            if (fs.existsSync(folderPath)) {
                fs.rmSync(folderPath, { recursive: true, force: true });
            }

            fs.writeFile(GALLERY_JSON_PATH, JSON.stringify(gallery, null, 2), (err) => {
                if (err) return res.status(500).json({ success: false });
                res.json({ success: true });
            });
        } else {
            res.status(404).json({ success: false, message: 'Category not found' });
        }
    });
});



// API: Get Config
app.get('/api/config', (req, res) => {
    fs.readFile(CONFIG_PATH, 'utf8', (err, data) => {
        if (err) {
            // Default config if file missing
            return res.json({ displayMode: 1 });
        }
        try {
            res.json(JSON.parse(data));
        } catch (e) {
            res.json({ displayMode: 1 });
        }
    });
});

// API: Update Config
app.post('/api/config', (req, res) => {
    const { displayMode } = req.body;
    if (![1, 2].includes(displayMode)) {
        return res.status(400).json({ success: false, message: 'Invalid mode' });
    }

    const config = { displayMode };
    fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Error saving config' });
        }
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
