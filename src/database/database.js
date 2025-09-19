const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '../../data/autoincome.db');
        this.db = null;
    }

    init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Database connection error:', err);
                    reject(err);
                } else {
                    console.log('✅ Database connected');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    createTables() {
        return new Promise((resolve, reject) => {
            const tables = [
                `CREATE TABLE IF NOT EXISTS trends (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    keyword TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    search_volume INTEGER DEFAULT 0,
                    growth_rate REAL DEFAULT 0,
                    competition_level TEXT DEFAULT 'medium',
                    sentiment_score REAL DEFAULT 0,
                    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    analyzed BOOLEAN DEFAULT FALSE,
                    UNIQUE(keyword, platform)
                )`,
                
                `CREATE TABLE IF NOT EXISTS opportunities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    trend_id INTEGER,
                    business_model TEXT NOT NULL,
                    profit_potential REAL DEFAULT 0,
                    difficulty_score INTEGER DEFAULT 5,
                    investment_required REAL DEFAULT 0,
                    roi_estimate REAL DEFAULT 0,
                    market_size TEXT DEFAULT 'medium',
                    competition_analysis TEXT,
                    ai_recommendation TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    status TEXT DEFAULT 'pending',
                    FOREIGN KEY(trend_id) REFERENCES trends(id)
                )`,
                
                `CREATE TABLE IF NOT EXISTS income_streams (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    opportunity_id INTEGER,
                    name TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    business_model TEXT NOT NULL,
                    initial_investment REAL DEFAULT 0,
                    current_revenue REAL DEFAULT 0,
                    current_expenses REAL DEFAULT 0,
                    profit_margin REAL DEFAULT 0,
                    status TEXT DEFAULT 'active',
                    products_count INTEGER DEFAULT 0,
                    customers_count INTEGER DEFAULT 0,
                    conversion_rate REAL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(opportunity_id) REFERENCES opportunities(id)
                )`,
                
                `CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    stream_id INTEGER,
                    name TEXT NOT NULL,
                    sku TEXT UNIQUE,
                    price REAL NOT NULL,
                    cost REAL DEFAULT 0,
                    supplier TEXT,
                    marketplace_url TEXT,
                    image_url TEXT,
                    description TEXT,
                    sales_count INTEGER DEFAULT 0,
                    revenue REAL DEFAULT 0,
                    status TEXT DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(stream_id) REFERENCES income_streams(id)
                )`,
                
                `CREATE TABLE IF NOT EXISTS customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    first_name TEXT,
                    last_name TEXT,
                    phone TEXT,
                    location TEXT,
                    total_orders INTEGER DEFAULT 0,
                    total_spent REAL DEFAULT 0,
                    avg_order_value REAL DEFAULT 0,
                    last_purchase_date DATETIME,
                    customer_segment TEXT DEFAULT 'new',
                    lifetime_value REAL DEFAULT 0,
                    acquisition_source TEXT,
                    email_subscribed BOOLEAN DEFAULT TRUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                
                `CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER,
                    product_id INTEGER,
                    stream_id INTEGER,
                    order_value REAL NOT NULL,
                    profit REAL DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    platform TEXT,
                    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(customer_id) REFERENCES customers(id),
                    FOREIGN KEY(product_id) REFERENCES products(id),
                    FOREIGN KEY(stream_id) REFERENCES income_streams(id)
                )`,
                
                `CREATE TABLE IF NOT EXISTS marketing_campaigns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    target_segment TEXT,
                    sent_count INTEGER DEFAULT 0,
                    open_rate REAL DEFAULT 0,
                    click_rate REAL DEFAULT 0,
                    conversion_rate REAL DEFAULT 0,
                    revenue_generated REAL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    status TEXT DEFAULT 'active'
                )`,
                
                `CREATE TABLE IF NOT EXISTS system_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    component TEXT NOT NULL,
                    action TEXT NOT NULL,
                    details TEXT,
                    success BOOLEAN DEFAULT TRUE,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            ];

            let completed = 0;
            tables.forEach((sql) => {
                this.db.run(sql, (err) => {
                    if (err) {
                        console.error('Table creation error:', err);
                        reject(err);
                    } else {
                        completed++;
                        if (completed === tables.length) {
                            console.log('✅ Database tables created');
                            resolve();
                        }
                    }
                });
            });
        });
    }

    // Trend methods
    async saveTrend(trendData) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT OR REPLACE INTO trends 
                (keyword, platform, search_volume, growth_rate, competition_level, sentiment_score) 
                VALUES (?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [
                trendData.keyword,
                trendData.platform,
                trendData.searchVolume || 0,
                trendData.growthRate || 0,
                trendData.competitionLevel || 'medium',
                trendData.sentimentScore || 0
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async getTrends(limit = 100) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM trends ORDER BY scraped_at DESC LIMIT ?`;
            this.db.all(sql, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async getTrendCount() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM trends', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
    }

    // Opportunity methods
    async saveOpportunity(opportunityData) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO opportunities 
                (trend_id, business_model, profit_potential, difficulty_score, investment_required, 
                 roi_estimate, market_size, competition_analysis, ai_recommendation) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [
                opportunityData.trendId,
                opportunityData.businessModel,
                opportunityData.profitPotential || 0,
                opportunityData.difficultyScore || 5,
                opportunityData.investmentRequired || 0,
                opportunityData.roiEstimate || 0,
                opportunityData.marketSize || 'medium',
                opportunityData.competitionAnalysis || '',
                opportunityData.aiRecommendation || ''
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async getOpportunities(limit = 50) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT o.*, t.keyword, t.platform 
                FROM opportunities o 
                JOIN trends t ON o.trend_id = t.id 
                WHERE o.status = 'pending'
                ORDER BY o.profit_potential DESC 
                LIMIT ?`;
            this.db.all(sql, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async getOpportunityCount() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM opportunities WHERE status = "pending"', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
    }

    // Income stream methods
    async createIncomeStream(streamData) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO income_streams 
                (opportunity_id, name, platform, business_model, initial_investment) 
                VALUES (?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [
                streamData.opportunityId,
                streamData.name,
                streamData.platform,
                streamData.businessModel,
                streamData.initialInvestment || 0
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async getIncomeStreams() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM income_streams ORDER BY created_at DESC`;
            this.db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async getIncomeStreamCount() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM income_streams WHERE status = "active"', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
    }

    async updateStreamMetrics(streamId, metrics) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE income_streams 
                SET current_revenue = ?, current_expenses = ?, profit_margin = ?, 
                    products_count = ?, customers_count = ?, conversion_rate = ?,
                    last_updated = CURRENT_TIMESTAMP
                WHERE id = ?`;
            
            this.db.run(sql, [
                metrics.revenue || 0,
                metrics.expenses || 0,
                metrics.profitMargin || 0,
                metrics.productsCount || 0,
                metrics.customersCount || 0,
                metrics.conversionRate || 0,
                streamId
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // Product methods
    async saveProduct(productData) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO products 
                (stream_id, name, sku, price, cost, supplier, marketplace_url, image_url, description) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [
                productData.streamId,
                productData.name,
                productData.sku,
                productData.price,
                productData.cost || 0,
                productData.supplier || '',
                productData.marketplaceUrl || '',
                productData.imageUrl || '',
                productData.description || ''
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    // Customer methods
    async saveCustomer(customerData) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT OR REPLACE INTO customers 
                (email, first_name, last_name, phone, location, acquisition_source) 
                VALUES (?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [
                customerData.email,
                customerData.firstName || '',
                customerData.lastName || '',
                customerData.phone || '',
                customerData.location || '',
                customerData.acquisitionSource || 'organic'
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async getCustomers(limit = 100) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM customers ORDER BY created_at DESC LIMIT ?`;
            this.db.all(sql, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async getCustomerCount() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM customers', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
    }

    // Order methods
    async saveOrder(orderData) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO orders 
                (customer_id, product_id, stream_id, order_value, profit, platform) 
                VALUES (?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [
                orderData.customerId,
                orderData.productId,
                orderData.streamId,
                orderData.orderValue,
                orderData.profit || 0,
                orderData.platform
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async getTotalProfits() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT 
                SUM(current_revenue) as revenue,
                SUM(current_revenue - current_expenses) as profit
                FROM income_streams`;
            this.db.get(sql, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    // System logging
    async log(component, action, details = '', success = true) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO system_logs (component, action, details, success) VALUES (?, ?, ?, ?)`;
            this.db.run(sql, [component, action, details, success], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = Database;
