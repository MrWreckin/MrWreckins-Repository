const nodemailer = require('nodemailer');

class EmailAutomation {
    constructor(database, customerManager) {
        this.db = database;
        this.customerManager = customerManager;
        this.transporter = null;
        this.templates = this.initializeTemplates();
        this.campaigns = {
            welcome: { enabled: true, delay: 0 },
            abandoned_cart: { enabled: true, delay: 24 * 60 * 60 * 1000 }, // 24 hours
            win_back: { enabled: true, delay: 30 * 24 * 60 * 60 * 1000 }, // 30 days
            product_recommendation: { enabled: true, delay: 7 * 24 * 60 * 60 * 1000 }, // 7 days
            loyalty_reward: { enabled: true, delay: 0 }
        };
    }

    async init() {
        try {
            this.transporter = nodemailer.createTransporter({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: process.env.SMTP_PORT || 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER || 'mrwreckinswreckshop@gmail.com',
                    pass: process.env.EMAIL_PASS || 'demo-password'
                }
            });

            // Verify connection
            if (process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_PASS !== 'demo-password') {
                await this.transporter.verify();
                console.log('✅ Email service connected successfully');
            } else {
                console.log('⚠️ Email service in demo mode - configure SMTP credentials for live emails');
            }

            return true;
        } catch (error) {
            console.error('Email service initialization failed:', error.message);
            return false;
        }
    }

    initializeTemplates() {
        return {
            welcome: {
                subject: '🎉 Welcome to MrWreckins WreckShop!',
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
                    <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #667eea; margin: 0;">🔧 MrWreckins WreckShop</h1>
                            <p style="color: #666; margin: 10px 0 0 0;">Your Autonomous Income Partner</p>
                        </div>
                        
                        <h2 style="color: #333;">Welcome {{firstName}}!</h2>
                        
                        <p>Thank you for choosing MrWreckins WreckShop! We're excited to have you as part of our community.</p>
                        
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="color: #667eea; margin-top: 0;">What's Next?</h3>
                            <ul style="color: #666; line-height: 1.6;">
                                <li>Browse our trending products</li>
                                <li>Follow us for the latest deals</li>
                                <li>Get exclusive member discounts</li>
                            </ul>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{{shopUrl}}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                Start Shopping
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
                            Questions? Reply to this email - we're here to help!
                        </p>
                    </div>
                </div>
                `
            },

            abandoned_cart: {
                subject: '🛒 You left something behind!',
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
                    <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #333;">Don't miss out, {{firstName}}!</h2>
                        
                        <p>You were checking out some great items but didn't complete your purchase. They're still waiting for you!</p>
                        
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="color: #667eea; margin-top: 0;">Your Items:</h3>
                            {{cartItems}}
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{{checkoutUrl}}" style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                Complete Your Purchase
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px;">
                            <strong>Limited time:</strong> Complete your purchase within 24 hours and get 10% off with code COMEBACK10
                        </p>
                    </div>
                </div>
                `
            },

            win_back: {
                subject: '💔 We miss you at MrWreckins WreckShop',
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
                    <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #333;">We miss you, {{firstName}}!</h2>
                        
                        <p>It's been a while since your last purchase, and we wanted to reach out with some exciting updates!</p>
                        
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="color: #667eea; margin-top: 0;">What's New:</h3>
                            <ul style="color: #666; line-height: 1.6;">
                                <li>{{newProducts}} new trending products</li>
                                <li>Improved customer service</li>
                                <li>Faster shipping options</li>
                            </ul>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{{shopUrl}}" style="background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                Welcome Back - 20% Off
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; text-align: center;">
                            Use code WELCOME20 for 20% off your next purchase
                        </p>
                    </div>
                </div>
                `
            },

            product_recommendation: {
                subject: '🔥 Trending now - Perfect for you!',
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
                    <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #333;">Hey {{firstName}}, check these out!</h2>
                        
                        <p>Based on your previous purchases, we think you'll love these trending items:</p>
                        
                        <div style="margin: 30px 0;">
                            {{recommendedProducts}}
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{{shopUrl}}" style="background: #8b5cf6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                Shop Recommendations
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; text-align: center;">
                            These items are trending fast - don't miss out!
                        </p>
                    </div>
                </div>
                `
            },

            loyalty_reward: {
                subject: '🎁 Thank you for being a loyal customer!',
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
                    <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #333;">You're amazing, {{firstName}}!</h2>
                        
                        <p>Thanks to loyal customers like you, MrWreckins WreckShop continues to grow and thrive!</p>
                        
                        <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                            <h3 style="margin-top: 0;">Your Stats:</h3>
                            <p style="font-size: 18px; margin: 10px 0;">
                                <strong>{{orderCount}}</strong> orders • <strong>${{totalSpent}}</strong> spent
                            </p>
                            <p style="margin: 0;">You're in our <strong>{{segment}}</strong> tier!</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{{rewardUrl}}" style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                Claim Your Reward
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; text-align: center;">
                            Exclusive {{rewardType}} just for you!
                        </p>
                    </div>
                </div>
                `
            }
        };
    }

    async sendWelcomeEmail(customer) {
        try {
            const template = this.templates.welcome;
            const html = template.html
                .replace(/{{firstName}}/g, customer.first_name || 'Friend')
                .replace(/{{shopUrl}}/g, 'https://facebook.com/marketplace');

            await this.sendEmail({
                to: customer.email,
                subject: template.subject,
                html: html
            });

            await this.logCampaign(customer.id, 'welcome', 'sent');
            console.log(`✅ Welcome email sent to ${customer.email}`);
            
        } catch (error) {
            console.error('Error sending welcome email:', error);
            await this.logCampaign(customer.id, 'welcome', 'failed', error.message);
        }
    }

    async sendAbandonedCartEmail(customer, cartData) {
        try {
            if (!this.campaigns.abandoned_cart.enabled) return;

            const template = this.templates.abandoned_cart;
            const cartItems = this.formatCartItems(cartData.items || []);
            
            const html = template.html
                .replace(/{{firstName}}/g, customer.first_name || 'Friend')
                .replace(/{{cartItems}}/g, cartItems)
                .replace(/{{checkoutUrl}}/g, cartData.checkoutUrl || 'https://facebook.com/marketplace');

            await this.sendEmail({
                to: customer.email,
                subject: template.subject,
                html: html
            });

            await this.logCampaign(customer.id, 'abandoned_cart', 'sent');
            console.log(`✅ Abandoned cart email sent to ${customer.email}`);
            
        } catch (error) {
            console.error('Error sending abandoned cart email:', error);
            await this.logCampaign(customer.id, 'abandoned_cart', 'failed', error.message);
        }
    }

    async sendWinBackEmail(customer) {
        try {
            if (!this.campaigns.win_back.enabled) return;

            const template = this.templates.win_back;
            const newProductsCount = await this.getNewProductsCount();
            
            const html = template.html
                .replace(/{{firstName}}/g, customer.first_name || 'Friend')
                .replace(/{{newProducts}}/g, newProductsCount)
                .replace(/{{shopUrl}}/g, 'https://facebook.com/marketplace');

            await this.sendEmail({
                to: customer.email,
                subject: template.subject,
                html: html
            });

            await this.logCampaign(customer.id, 'win_back', 'sent');
            console.log(`✅ Win-back email sent to ${customer.email}`);
            
        } catch (error) {
            console.error('Error sending win-back email:', error);
            await this.logCampaign(customer.id, 'win_back', 'failed', error.message);
        }
    }

    async sendProductRecommendationEmail(customer) {
        try {
            if (!this.campaigns.product_recommendation.enabled) return;

            const template = this.templates.product_recommendation;
            const recommendations = await this.getProductRecommendations(customer);
            
            const html = template.html
                .replace(/{{firstName}}/g, customer.first_name || 'Friend')
                .replace(/{{recommendedProducts}}/g, this.formatProductRecommendations(recommendations))
                .replace(/{{shopUrl}}/g, 'https://facebook.com/marketplace');

            await this.sendEmail({
                to: customer.email,
                subject: template.subject,
                html: html
            });

            await this.logCampaign(customer.id, 'product_recommendation', 'sent');
            console.log(`✅ Product recommendation email sent to ${customer.email}`);
            
        } catch (error) {
            console.error('Error sending product recommendation email:', error);
            await this.logCampaign(customer.id, 'product_recommendation', 'failed', error.message);
        }
    }

    async sendLoyaltyRewardEmail(customer) {
        try {
            if (!this.campaigns.loyalty_reward.enabled) return;

            const template = this.templates.loyalty_reward;
            const rewardType = this.getRewardType(customer.segment);
            
            const html = template.html
                .replace(/{{firstName}}/g, customer.first_name || 'Friend')
                .replace(/{{orderCount}}/g, customer.order_count || 0)
                .replace(/{{totalSpent}}/g, (customer.total_spent || 0).toFixed(2))
                .replace(/{{segment}}/g, customer.segment || 'regular')
                .replace(/{{rewardType}}/g, rewardType)
                .replace(/{{rewardUrl}}/g, 'https://facebook.com/marketplace');

            await this.sendEmail({
                to: customer.email,
                subject: template.subject,
                html: html
            });

            await this.logCampaign(customer.id, 'loyalty_reward', 'sent');
            console.log(`✅ Loyalty reward email sent to ${customer.email}`);
            
        } catch (error) {
            console.error('Error sending loyalty reward email:', error);
            await this.logCampaign(customer.id, 'loyalty_reward', 'failed', error.message);
        }
    }

    async sendEmail(emailData) {
        if (!this.transporter || !process.env.EMAIL_USER || process.env.EMAIL_PASS === 'demo-password') {
            console.log(`📧 [DEMO] Email would be sent to ${emailData.to}: ${emailData.subject}`);
            return { messageId: 'demo-' + Date.now() };
        }

        const mailOptions = {
            from: `"MrWreckins WreckShop" <${process.env.EMAIL_USER}>`,
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text || this.htmlToText(emailData.html)
        };

        return await this.transporter.sendMail(mailOptions);
    }

    htmlToText(html) {
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    formatCartItems(items) {
        if (!items || items.length === 0) {
            return '<p>Your selected items</p>';
        }

        return items.map(item => `
            <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                <strong>${item.name}</strong><br>
                <span style="color: #666;">$${item.price} × ${item.quantity}</span>
            </div>
        `).join('');
    }

    formatProductRecommendations(products) {
        if (!products || products.length === 0) {
            return '<p>Check out our latest trending products!</p>';
        }

        return products.map(product => `
            <div style="border: 1px solid #eee; border-radius: 8px; padding: 15px; margin: 10px 0;">
                <h4 style="margin: 0 0 10px 0; color: #333;">${product.name}</h4>
                <p style="color: #666; margin: 0 0 10px 0;">$${product.price}</p>
                <a href="${product.url || '#'}" style="color: #667eea; text-decoration: none;">View Product →</a>
            </div>
        `).join('');
    }

    getRewardType(segment) {
        const rewards = {
            vip: '25% discount + free shipping',
            high_value: '20% discount',
            regular: '15% discount',
            new: '10% welcome discount'
        };
        return rewards[segment] || '10% discount';
    }

    async getNewProductsCount() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) as count FROM products WHERE created_at >= date('now', '-30 days')`;
            this.db.db.get(sql, (err, row) => {
                if (err) reject(err);
                else resolve(row.count || 0);
            });
        });
    }

    async getProductRecommendations(customer, limit = 3) {
        // Simple recommendation based on trending products
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM products WHERE status = 'active' ORDER BY created_at DESC LIMIT ?`;
            this.db.db.all(sql, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async logCampaign(customerId, campaignType, status, error = null) {
        try {
            const campaign = {
                customerId: customerId,
                type: campaignType,
                status: status,
                error: error,
                sentAt: new Date().toISOString()
            };

            await this.db.saveCampaign(campaign);
        } catch (error) {
            console.error('Error logging campaign:', error);
        }
    }

    async runAutomatedCampaigns() {
        try {
            console.log('📧 Running automated email campaigns...');
            
            let emailsSent = 0;

            // Welcome emails for new customers
            const newCustomers = await this.getNewCustomersForWelcome();
            for (const customer of newCustomers) {
                await this.sendWelcomeEmail(customer);
                emailsSent++;
            }

            // Win-back emails for inactive customers
            const inactiveCustomers = await this.getInactiveCustomers();
            for (const customer of inactiveCustomers) {
                await this.sendWinBackEmail(customer);
                emailsSent++;
            }

            // Product recommendations for regular customers
            const regularCustomers = await this.getCustomersForRecommendations();
            for (const customer of regularCustomers) {
                await this.sendProductRecommendationEmail(customer);
                emailsSent++;
            }

            // Loyalty rewards for high-value customers
            const loyalCustomers = await this.getLoyalCustomers();
            for (const customer of loyalCustomers) {
                await this.sendLoyaltyRewardEmail(customer);
                emailsSent++;
            }

            await this.db.log('EmailAutomation', 'runAutomatedCampaigns', `Sent ${emailsSent} emails`);
            console.log(`✅ Sent ${emailsSent} automated emails`);
            
            return emailsSent;
        } catch (error) {
            console.error('Error running automated campaigns:', error);
            return 0;
        }
    }

    async getNewCustomersForWelcome() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT c.* FROM customers c
                LEFT JOIN marketing_campaigns mc ON c.id = mc.customer_id AND mc.type = 'welcome'
                WHERE c.created_at >= date('now', '-1 days') 
                AND mc.id IS NULL
                LIMIT 10
            `;
            this.db.db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getInactiveCustomers() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT c.* FROM customers c
                LEFT JOIN marketing_campaigns mc ON c.id = mc.customer_id AND mc.type = 'win_back' AND mc.sent_at >= date('now', '-30 days')
                WHERE c.last_order_date <= date('now', '-30 days')
                AND c.order_count > 0
                AND mc.id IS NULL
                LIMIT 5
            `;
            this.db.db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getCustomersForRecommendations() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT c.* FROM customers c
                LEFT JOIN marketing_campaigns mc ON c.id = mc.customer_id AND mc.type = 'product_recommendation' AND mc.sent_at >= date('now', '-7 days')
                WHERE c.segment IN ('regular', 'high_value')
                AND c.last_order_date >= date('now', '-60 days')
                AND mc.id IS NULL
                LIMIT 10
            `;
            this.db.db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getLoyalCustomers() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT c.* FROM customers c
                LEFT JOIN marketing_campaigns mc ON c.id = mc.customer_id AND mc.type = 'loyalty_reward' AND mc.sent_at >= date('now', '-90 days')
                WHERE c.segment IN ('vip', 'high_value')
                AND c.order_count >= 3
                AND mc.id IS NULL
                LIMIT 5
            `;
            this.db.db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getCampaignStats() {
        try {
            const stats = await Promise.all([
                this.getCampaignCount('welcome'),
                this.getCampaignCount('abandoned_cart'),
                this.getCampaignCount('win_back'),
                this.getCampaignCount('product_recommendation'),
                this.getCampaignCount('loyalty_reward')
            ]);

            return {
                welcome: stats[0],
                abandoned_cart: stats[1],
                win_back: stats[2],
                product_recommendation: stats[3],
                loyalty_reward: stats[4],
                total: stats.reduce((sum, count) => sum + count, 0)
            };
        } catch (error) {
            console.error('Error getting campaign stats:', error);
            return null;
        }
    }

    async getCampaignCount(type) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) as count FROM marketing_campaigns WHERE type = ? AND status = 'sent'`;
            this.db.db.get(sql, [type], (err, row) => {
                if (err) reject(err);
                else resolve(row.count || 0);
            });
        });
    }
}

module.exports = EmailAutomation;
