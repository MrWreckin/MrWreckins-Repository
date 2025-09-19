const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

class AutoIncomeSystem {
    constructor() {
        console.log('Initializing AutoIncomeSystem...');
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        // Lazy-load local modules with fallbacks to prevent early crashes
        try {
            const Database = require('./database/database');
            this.db = new Database();
        } catch (err) {
            console.error('Failed to load Database module:', err);
            this.db = {
                init: async () => console.warn('DB init noop'),
                getTrendCount: async () => 0,
                getOpportunityCount: async () => 0,
                getIncomeStreamCount: async () => 0,
                getCustomerCount: async () => 0,
                getTotalProfits: async () => ({ revenue: 0, profit: 0 }),
                getTrends: async () => [],
                getOpportunities: async () => [],
                getIncomeStreams: async () => [],
                getCustomers: async () => [],
                log: async () => {}
            };
        }

        try {
            const TrendScraper = require('./scrapers/trendScraper');
            this.trendScraper = new TrendScraper(this.db);
        } catch (err) {
            console.error('Failed to load TrendScraper:', err);
            this.trendScraper = { scrapeAll: async () => 0 };
        }

        try {
            const TrendAnalyzer = require('./ai/trendAnalyzer');
            this.trendAnalyzer = new TrendAnalyzer(this.db);
        } catch (err) {
            console.error('Failed to load TrendAnalyzer:', err);
            this.trendAnalyzer = { analyzeAll: async () => 0 };
        }

        try {
            const MarketplaceBot = require('./automation/marketplaceBot');
            this.marketplaceBot = new MarketplaceBot(this.db);
        } catch (err) {
            console.error('Failed to load MarketplaceBot:', err);
            this.marketplaceBot = {
                createIncomeStream: async () => ({}),
                checkOpportunities: async () => 0
            };
        }

        try {
            const ProfitTracker = require('./automation/profitTracker');
            this.profitTracker = new ProfitTracker(this.db);
        } catch (err) {
            console.error('Failed to load ProfitTracker:', err);
            this.profitTracker = { updateProfits: async () => ({ ok: true }) };
        }

        try {
            const EmailAutomation = require('./automation/emailAutomation');
            this.emailAutomation = new EmailAutomation(this.db);
        } catch (err) {
            console.error('Failed to load EmailAutomation:', err);
            this.emailAutomation = { sendDailyEmails: async () => ({ ok: true }) };
        }
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '../public')));
        
        // CORS for development
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
    }

    setupRoutes() {
        // Dashboard route
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ ok: true, uptime: process.uptime(), time: new Date().toISOString() });
        });

        // API Routes
        this.app.get('/api/dashboard', async (req, res) => {
            try {
                const stats = await this.getDashboardStats();
                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/trends', async (req, res) => {
            try {
                const trends = await this.db.getTrends();
                res.json(trends);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/opportunities', async (req, res) => {
            try {
                const opportunities = await this.db.getOpportunities();
                res.json(opportunities);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/income-streams', async (req, res) => {
            try {
                const streams = await this.db.getIncomeStreams();
                res.json(streams);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Compatibility alias for frontend expecting /api/streams
        this.app.get('/api/streams', async (req, res) => {
            try {
                const streams = await this.db.getIncomeStreams();
                res.json(streams);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/create-stream', async (req, res) => {
            try {
                const { trendId, platform, budget } = req.body;
                const stream = await this.marketplaceBot.createIncomeStream(trendId, platform, budget);
                res.json(stream);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/customers', async (req, res) => {
            try {
                const customers = await this.db.getCustomers();
                res.json(customers);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Manual trigger endpoints
        this.app.post('/api/scrape-trends', async (req, res) => {
            try {
                await this.trendScraper.scrapeAll();
                res.json({ message: 'Trend scraping initiated' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Compatibility alias for frontend expecting /api/scan-trends
        this.app.post('/api/scan-trends', async (req, res) => {
            try {
                await this.trendScraper.scrapeAll();
                res.json({ message: 'Trend scanning initiated' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/analyze-trends', async (req, res) => {
            try {
                await this.trendAnalyzer.analyzeAll();
                res.json({ message: 'Trend analysis initiated' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Products endpoint (return empty list if DB method is not defined)
        this.app.get('/api/products', async (req, res) => {
            try {
                if (typeof this.db.getProducts === 'function') {
                    const products = await this.db.getProducts();
                    res.json(products);
                } else {
                    res.json([]);
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Automation control endpoint (no-op placeholder for now)
        this.app.post('/api/automation/start', async (req, res) => {
            try {
                // In the future, wire this to actually toggle/ensure timers
                res.json({ ok: true, message: 'Automation services acknowledged' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('Dashboard connected');
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    console.error('WebSocket message error:', error);
                }
            });

            ws.on('close', () => {
                console.log('Dashboard disconnected');
            });
        });
    }

    handleWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'get_live_stats':
                this.sendLiveStats(ws);
                break;
            case 'manual_scrape':
                this.trendScraper.scrapeAll();
                break;
            case 'manual_analyze':
                this.trendAnalyzer.analyzeAll();
                break;
        }
    }

    async sendLiveStats(ws) {
        try {
            const stats = await this.getDashboardStats();
            ws.send(JSON.stringify({ type: 'live_stats', data: stats }));
        } catch (error) {
            console.error('Error sending live stats:', error);
        }
    }

    broadcast(message) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }

    async getDashboardStats() {
        const [trends, opportunities, streams, customers, profits] = await Promise.all([
            this.db.getTrendCount(),
            this.db.getOpportunityCount(),
            this.db.getIncomeStreamCount(),
            this.db.getCustomerCount(),
            this.db.getTotalProfits()
        ]);

        return {
            trends: trends || 0,
            opportunities: opportunities || 0,
            activeStreams: streams || 0,
            customers: customers || 0,
            totalRevenue: profits?.revenue || 0,
            totalProfit: profits?.profit || 0,
            lastUpdate: new Date().toISOString()
        };
    }

    startAutomation() {
        console.log('🚀 Starting MrWreckins AutoIncome System...');
        
        // Initialize database
        Promise.resolve()
            .then(() => {
                console.log('Initializing database...');
                return this.db.init();
            })
            .then(() => console.log('Database initialized'))
            .catch((err) => console.error('Database initialization failed:', err));
        
        // Start trend scraping every 10 minutes
        setInterval(() => {
            this.trendScraper.scrapeAll();
        }, 10 * 60 * 1000);

        // Analyze trends every 30 minutes
        setInterval(() => {
            this.trendAnalyzer.analyzeAll();
        }, 30 * 60 * 1000);

        // Check for new opportunities every hour
        setInterval(() => {
            this.marketplaceBot.checkOpportunities();
        }, 60 * 60 * 1000);

        // Update profit tracking every 2 hours
        setInterval(() => {
            this.profitTracker.updateProfits();
        }, 2 * 60 * 60 * 1000);

        // Send marketing emails daily
        setInterval(() => {
            this.emailAutomation.sendDailyEmails();
        }, 24 * 60 * 60 * 1000);

        // Broadcast live updates every 30 seconds
        setInterval(() => {
            this.getDashboardStats().then(stats => {
                this.broadcast({ type: 'stats_update', data: stats });
            });
        }, 30 * 1000);

        console.log('✅ All automation systems started');
        
        // Initial scrape
        setTimeout(() => {
            this.trendScraper.scrapeAll();
        }, 5000);
    }

    start(port = 3000) {
        this.server.on('error', (err) => {
            console.error('Server listen error:', err);
        });
        console.log(`Attempting to start server on port ${port}...`);
        this.server.listen(port, () => {
            console.log(`🌐 MrWreckins AutoIncome Dashboard: http://localhost:${port}`);
            console.log('💰 Autonomous income generation is now active!');
            if (String(process.env.DISABLE_AUTOMATION || '').toLowerCase() === '1' ||
                String(process.env.DISABLE_AUTOMATION || '').toLowerCase() === 'true') {
                console.log('⚠️ Automation disabled by DISABLE_AUTOMATION env var');
            } else {
                this.startAutomation();
            }
        });
    }
}

// Global error handlers to avoid silent exits
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
});

// Start the system
console.log('Bootstrapping MrWreckins AutoIncome System...');
const autoIncome = new AutoIncomeSystem();
autoIncome.start(process.env.PORT || 3000);

module.exports = AutoIncomeSystem;
