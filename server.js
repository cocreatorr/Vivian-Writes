require('dotenv').config();

console.log('=== Starting Server ===');
console.log('Admin password:', process.env.ADMIN_PASSWORD || 'using default');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Stronger admin authentication
const adminAuth = (req, res, next) => {
    const adminPassword = process.env.ADMIN_PASSWORD || 'mysecretpassword123';
    
    // Explicitly protect the admin HTML page
    if (req.path === '/admin' && req.method === 'GET') {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            console.log('🔐 Prompting for admin password');
            res.setHeader('WWW-Authenticate', 'Basic realm="Admin Access"');
            return res.status(401).send('Admin access required');
        }
        
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(':');
        
        if (username === 'admin' && password === adminPassword) {
            console.log('✅ Admin login successful');
            return next();
        } else {
            res.setHeader('WWW-Authenticate', 'Basic realm="Admin Access"');
            return res.status(401).send('Invalid credentials');
        }
    }
    
    // Protect article creation and deletion
    if ((req.method === 'POST' || req.method === 'DELETE') && req.path.startsWith('/api/articles')) {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).send('Authentication required');
        }
        
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(':');
        
        if (username === 'admin' && password === adminPassword) {
            return next();
        } else {
            return res.status(401).send('Invalid credentials');
        }
    }
    
    // Allow everything else
    next();
};
// Apply authentication middleware
app.use(adminAuth);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myblog')
    .then(() => {
        console.log('✅ Connected to MongoDB successfully!');
    })
    .catch((error) => {
        console.log('❌ MongoDB connection error:', error.message);
    });

// Article schema
const articleSchema = new mongoose.Schema({
    title: String,
    content: String,
    category: String,
    imageUrl: String,
    createdAt: { type: Date, default: Date.now }
});

const Article = mongoose.model('Article', articleSchema);

// API Routes
app.get('/api/articles', async (req, res) => {
    try {
        const articles = await Article.find().sort({ createdAt: -1 });
        res.json(articles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/articles', async (req, res) => {
    try {
        const article = new Article(req.body);
        await article.save();
        res.status(201).json(article);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/articles/:id', async (req, res) => {
    try {
        const article = await Article.findById(req.params.id);
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        res.json(article);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE article route
app.delete('/api/articles/:id', async (req, res) => {
    try {
        const article = await Article.findByIdAndDelete(req.params.id);
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        res.json({ message: 'Article deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get categories with counts
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Article.aggregate([
            { $match: { category: { $ne: null, $ne: '' } } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get related articles (for digital garden linking)
app.get('/api/articles/related/:id', async (req, res) => {
    try {
        const currentArticle = await Article.findById(req.params.id);
        if (!currentArticle) {
            return res.status(404).json({ error: 'Article not found' });
        }
        
        // Find articles with similar categories or keywords
        const relatedArticles = await Article.find({
            _id: { $ne: req.params.id }, // Exclude current article
            $or: [
                { category: currentArticle.category },
                { title: { $regex: currentArticle.category, $options: 'i' } }
            ]
        }).limit(3);
        
        res.json(relatedArticles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Routes for serving HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

// Contact form routes (commented out as requested)
// app.post('/api/contact', async (req, res) => {
//     try {
//         const { name, email, message } = req.body;
//         console.log('Contact form submission:', { name, email, message });
//         res.json({ success: true, message: 'Thank you for your message! I will get back to you soon.' });
//     } catch (error) {
//         res.status(500).json({ success: false, message: 'Error sending message' });
//     }
// });

// app.get('/contact', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'contact.html'));
// });

// Start server
app.listen(PORT, (err) => {
    if (err) {
        console.error('❌ Server failed to start:', err);
        process.exit(1);
    }
    console.log(`✅ Server is running on http://localhost:${PORT}`);
    console.log(`✅ Admin panel: http://localhost:${PORT}/admin`);
    console.log(`✅ Test in Incognito mode to see password prompt`);
});