const puppeteer = require('puppeteer');
const axios = require('axios');

class MarketplaceBot {
    constructor(database) {
        this.db = database;
        this.browser = null;
        this.platforms = {
            facebook: 'https://www.facebook.com/marketplace',
            ebay: 'https://www.ebay.com',
            etsy: 'https://www.etsy.com',
            craigslist: 'https://craigslist.org'
        };
        this.suppliers = {
            aliexpress: 'https://www.aliexpress.com',
            walmart: 'https://www.walmart.com',
            amazon: 'https://www.amazon.com'
        };
    }

    async init() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
    }

    async checkOpportunities() {
        console.log('🤖 Checking for new marketplace opportunities...');
        
        try {
            const opportunities = await this.db.getOpportunities(10);
            const highValueOpps = opportunities.filter(opp => 
                opp.profit_potential >= 7 && 
                opp.investment_required <= 200 &&
                opp.status === 'pending'
            );

            let createdStreams = 0;
            
            for (const opportunity of highValueOpps) {
                try {
                    const stream = await this.createIncomeStream(
                        opportunity.id, 
                        'facebook_marketplace', 
                        opportunity.investment_required
                    );
                    
                    if (stream) {
                        createdStreams++;
                        await this.updateOpportunityStatus(opportunity.id, 'implemented');
                    }
                } catch (error) {
                    console.error(`Error creating stream for opportunity ${opportunity.id}:`, error.message);
                }
            }

            await this.db.log('MarketplaceBot', 'checkOpportunities', `Created ${createdStreams} new income streams`);
            console.log(`✅ Created ${createdStreams} new income streams`);
            
            return createdStreams;
        } catch (error) {
            console.error('Error checking opportunities:', error);
            await this.db.log('MarketplaceBot', 'checkOpportunities', error.message, false);
            return 0;
        }
    }

    async createIncomeStream(opportunityId, platform, budget) {
        try {
            const opportunity = await this.getOpportunityById(opportunityId);
            if (!opportunity) return null;

            const streamName = `${opportunity.keyword} - ${opportunity.business_model}`;
            
            const streamId = await this.db.createIncomeStream({
                opportunityId: opportunityId,
                name: streamName,
                platform: platform,
                businessModel: opportunity.business_model,
                initialInvestment: budget
            });

            // Generate products for the stream
            const products = await this.generateProducts(opportunity, streamId, budget);
            
            // List products on marketplace
            for (const product of products) {
                await this.listProduct(product, platform);
            }

            await this.db.log('MarketplaceBot', 'createIncomeStream', `Created stream: ${streamName}`);
            
            return {
                id: streamId,
                name: streamName,
                platform: platform,
                products: products.length
            };
        } catch (error) {
            console.error('Error creating income stream:', error);
            return null;
        }
    }

    async generateProducts(opportunity, streamId, budget) {
        const products = [];
        const productCount = Math.min(5, Math.floor(budget / 20) + 1);
        
        for (let i = 0; i < productCount; i++) {
            const product = await this.createProduct(opportunity, streamId, i);
            if (product) {
                products.push(product);
            }
        }
        
        return products;
    }

    async createProduct(opportunity, streamId, index) {
        try {
            const baseKeyword = opportunity.keyword;
            const variations = [
                `Premium ${baseKeyword}`,
                `Professional ${baseKeyword}`,
                `Deluxe ${baseKeyword}`,
                `Essential ${baseKeyword}`,
                `Complete ${baseKeyword} Kit`
            ];
            
            const productName = variations[index] || `${baseKeyword} Pro`;
            const sku = `MRW-${Date.now()}-${index}`;
            
            // Calculate pricing based on business model
            const pricing = this.calculatePricing(opportunity.business_model, opportunity.profit_potential);
            
            const productData = {
                streamId: streamId,
                name: productName,
                sku: sku,
                price: pricing.price,
                cost: pricing.cost,
                supplier: this.selectSupplier(opportunity.business_model),
                description: this.generateProductDescription(productName, opportunity),
                imageUrl: await this.generateProductImage(productName)
            };

            const productId = await this.db.saveProduct(productData);
            
            return {
                id: productId,
                ...productData
            };
        } catch (error) {
            console.error('Error creating product:', error);
            return null;
        }
    }

    calculatePricing(businessModel, profitPotential) {
        const basePrices = {
            dropshipping: { min: 15, max: 75 },
            digital_products: { min: 9, max: 49 },
            print_on_demand: { min: 12, max: 35 },
            service_arbitrage: { min: 25, max: 150 }
        };
        
        const priceRange = basePrices[businessModel] || { min: 20, max: 60 };
        const price = priceRange.min + ((priceRange.max - priceRange.min) * (profitPotential / 10));
        
        const costMultipliers = {
            dropshipping: 0.4,
            digital_products: 0.1,
            print_on_demand: 0.3,
            service_arbitrage: 0.5
        };
        
        const cost = price * (costMultipliers[businessModel] || 0.4);
        
        return {
            price: Math.round(price * 100) / 100,
            cost: Math.round(cost * 100) / 100
        };
    }

    selectSupplier(businessModel) {
        const suppliers = {
            dropshipping: 'AliExpress',
            digital_products: 'Self-Created',
            print_on_demand: 'Printful',
            service_arbitrage: 'Freelancer Network'
        };
        
        return suppliers[businessModel] || 'Various';
    }

    generateProductDescription(productName, opportunity) {
        const templates = {
            dropshipping: `🔥 TRENDING NOW: ${productName}

✅ High Quality & Fast Shipping
✅ Perfect for ${opportunity.keyword} enthusiasts
✅ Satisfaction Guaranteed
✅ MrWreckins WreckShop Quality Promise

🚚 Fast & Free Shipping Available
💬 Message us for bulk discounts!
⭐ Join thousands of satisfied customers

#MrWreckinsWreckShop #${opportunity.keyword.replace(/\s+/g, '')}`,

            digital_products: `📚 INSTANT DOWNLOAD: ${productName}

🎯 Complete guide to ${opportunity.keyword}
📋 Step-by-step instructions
💡 Pro tips and strategies
🔄 Lifetime updates included

✨ Digital delivery - Get started immediately!
💰 Money-back guarantee
🏆 Created by industry experts

#DigitalGuide #${opportunity.keyword.replace(/\s+/g, '')}`,

            print_on_demand: `👕 CUSTOM DESIGN: ${productName}

🎨 Unique ${opportunity.keyword} themed design
👔 Premium quality materials
🌟 Perfect gift for enthusiasts
🚚 Print on demand - Made to order

✅ Multiple sizes available
🎁 Great for gifts
💯 100% satisfaction guarantee

#CustomDesign #${opportunity.keyword.replace(/\s+/g, '')}`,

            service_arbitrage: `🔧 PROFESSIONAL SERVICE: ${productName}

👨‍💼 Expert ${opportunity.keyword} services
⚡ Fast turnaround time
💼 Professional results guaranteed
📞 Dedicated support included

✅ Experienced team
🎯 Customized solutions
💰 Competitive pricing
🏆 5-star rated service

#ProfessionalService #${opportunity.keyword.replace(/\s+/g, '')}`
        };

        return templates[opportunity.business_model] || templates.dropshipping;
    }

    async generateProductImage(productName) {
        // Simulate image generation (in production, use AI image generation or stock photos)
        const imageId = Math.random().toString(36).substr(2, 9);
        return `https://via.placeholder.com/400x400/667eea/ffffff?text=${encodeURIComponent(productName)}`;
    }

    async listProduct(product, platform) {
        try {
            // Simulate marketplace listing
            const listingData = {
                title: product.name,
                description: product.description,
                price: product.price,
                images: [product.imageUrl],
                category: this.categorizeProduct(product.name),
                condition: 'new',
                shipping: 'free'
            };

            // In production, integrate with actual marketplace APIs
            const listingUrl = await this.simulateMarketplaceListing(listingData, platform);
            
            // Update product with marketplace URL
            await this.updateProductMarketplaceUrl(product.id, listingUrl);
            
            await this.db.log('MarketplaceBot', 'listProduct', `Listed ${product.name} on ${platform}`);
            
            return listingUrl;
        } catch (error) {
            console.error(`Error listing product ${product.name}:`, error);
            return null;
        }
    }

    async simulateMarketplaceListing(listingData, platform) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const listingId = Math.random().toString(36).substr(2, 9);
        return `https://${platform}.com/listing/${listingId}`;
    }

    categorizeProduct(productName) {
        const categories = {
            'tech': ['gadget', 'device', 'charger', 'cable', 'stand'],
            'home': ['organizer', 'container', 'kit', 'holder'],
            'health': ['wellness', 'fitness', 'monitor', 'tracker'],
            'fashion': ['accessory', 'style', 'design'],
            'business': ['professional', 'office', 'productivity']
        };
        
        const nameLower = productName.toLowerCase();
        
        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => nameLower.includes(keyword))) {
                return category;
            }
        }
        
        return 'general';
    }

    async updateProductMarketplaceUrl(productId, url) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE products SET marketplace_url = ? WHERE id = ?`;
            this.db.db.run(sql, [url, productId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async updateOpportunityStatus(opportunityId, status) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE opportunities SET status = ? WHERE id = ?`;
            this.db.db.run(sql, [status, opportunityId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getOpportunityById(id) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT o.*, t.keyword FROM opportunities o JOIN trends t ON o.trend_id = t.id WHERE o.id = ?`;
            this.db.db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async monitorPerformance() {
        try {
            const streams = await this.db.getIncomeStreams();
            
            for (const stream of streams) {
                if (stream.status === 'active') {
                    await this.updateStreamPerformance(stream);
                }
            }
            
            await this.db.log('MarketplaceBot', 'monitorPerformance', `Monitored ${streams.length} streams`);
        } catch (error) {
            console.error('Error monitoring performance:', error);
        }
    }

    async updateStreamPerformance(stream) {
        // Simulate performance data
        const daysActive = Math.floor((Date.now() - new Date(stream.created_at)) / (1000 * 60 * 60 * 24));
        const baseRevenue = stream.initial_investment * 0.1 * Math.max(1, daysActive);
        
        const metrics = {
            revenue: baseRevenue + (Math.random() * baseRevenue * 0.5),
            expenses: stream.initial_investment + (baseRevenue * 0.3),
            profitMargin: 0,
            productsCount: stream.products_count || 0,
            customersCount: Math.floor(Math.random() * 20) + 1,
            conversionRate: Math.random() * 5 + 1
        };
        
        metrics.profitMargin = metrics.revenue > 0 ? 
            ((metrics.revenue - metrics.expenses) / metrics.revenue) * 100 : 0;
        
        await this.db.updateStreamMetrics(stream.id, metrics);
    }

    async optimizePricing() {
        try {
            console.log('💰 Optimizing product pricing...');
            
            // Get all active products
            const products = await this.getActiveProducts();
            
            for (const product of products) {
                const newPrice = await this.calculateOptimalPrice(product);
                if (Math.abs(newPrice - product.price) > product.price * 0.05) {
                    await this.updateProductPrice(product.id, newPrice);
                }
            }
            
            await this.db.log('MarketplaceBot', 'optimizePricing', `Optimized pricing for ${products.length} products`);
        } catch (error) {
            console.error('Error optimizing pricing:', error);
        }
    }

    async calculateOptimalPrice(product) {
        // Simple pricing optimization algorithm
        const salesPerformance = product.sales_count || 0;
        const daysSinceListing = Math.floor((Date.now() - new Date(product.created_at)) / (1000 * 60 * 60 * 24));
        
        let priceMultiplier = 1.0;
        
        // Increase price if selling well
        if (salesPerformance > 5 && daysSinceListing > 7) {
            priceMultiplier = 1.1;
        }
        // Decrease price if not selling
        else if (salesPerformance === 0 && daysSinceListing > 14) {
            priceMultiplier = 0.9;
        }
        
        const newPrice = product.price * priceMultiplier;
        const minPrice = product.cost * 1.5; // Minimum 50% markup
        
        return Math.max(minPrice, newPrice);
    }

    async getActiveProducts() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM products WHERE status = 'active'`;
            this.db.db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async updateProductPrice(productId, newPrice) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE products SET price = ? WHERE id = ?`;
            this.db.db.run(sql, [newPrice, productId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

module.exports = MarketplaceBot;
