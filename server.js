const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const GALLERY_JSON_PATH = path.join(__dirname, 'gallery.json');

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
app.post('/api/upload', upload.single('image'), (req, res) => {
    const { category } = req.body;
    const file = req.file;

    if (!file || !category) {
        return res.status(400).json({ success: false, message: 'Missing file or category' });
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

        // Avoid duplicates
        if (!gallery[category].includes(relativePath)) {
            gallery[category].push(relativePath);
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
            gallery[category] = gallery[category].filter(img => img !== imagePath);

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



app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
