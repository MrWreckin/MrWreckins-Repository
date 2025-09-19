class CustomerManager {
    constructor(database) {
        this.db = database;
        this.segments = {
            high_value: { minOrderValue: 100, minOrders: 3 },
            regular: { minOrderValue: 25, minOrders: 1 },
            new: { maxDaysSinceFirst: 7 },
            at_risk: { daysSinceLastOrder: 30, minOrders: 2 },
            vip: { minOrderValue: 200, minOrders: 5 }
        };
    }

    async createCustomer(customerData) {
        try {
            const customer = {
                email: customerData.email,
                firstName: customerData.firstName || '',
                lastName: customerData.lastName || '',
                phone: customerData.phone || '',
                address: customerData.address || '',
                city: customerData.city || '',
                state: customerData.state || '',
                zipCode: customerData.zipCode || '',
                country: customerData.country || 'US',
                source: customerData.source || 'marketplace',
                totalSpent: 0,
                orderCount: 0,
                averageOrderValue: 0,
                lastOrderDate: null,
                segment: 'new',
                tags: JSON.stringify(customerData.tags || []),
                preferences: JSON.stringify(customerData.preferences || {}),
                notes: customerData.notes || '',
                createdAt: new Date().toISOString()
            };

            const customerId = await this.db.saveCustomer(customer);
            
            await this.db.log('CustomerManager', 'createCustomer', `Created customer: ${customer.email}`);
            
            return { id: customerId, ...customer };
        } catch (error) {
            console.error('Error creating customer:', error);
            throw error;
        }
    }

    async updateCustomer(customerId, updates) {
        try {
            const updateFields = [];
            const values = [];
            
            Object.keys(updates).forEach(key => {
                if (updates[key] !== undefined) {
                    updateFields.push(`${key} = ?`);
                    values.push(typeof updates[key] === 'object' ? JSON.stringify(updates[key]) : updates[key]);
                }
            });
            
            if (updateFields.length === 0) return false;
            
            values.push(customerId);
            const sql = `UPDATE customers SET ${updateFields.join(', ')}, updated_at = datetime('now') WHERE id = ?`;
            
            return new Promise((resolve, reject) => {
                this.db.db.run(sql, values, function(err) {
                    if (err) reject(err);
                    else resolve(this.changes > 0);
                });
            });
        } catch (error) {
            console.error('Error updating customer:', error);
            return false;
        }
    }

    async processOrder(orderData) {
        try {
            // Find or create customer
            let customer = await this.findCustomerByEmail(orderData.customerEmail);
            
            if (!customer) {
                customer = await this.createCustomer({
                    email: orderData.customerEmail,
                    firstName: orderData.firstName,
                    lastName: orderData.lastName,
                    phone: orderData.phone,
                    address: orderData.address,
                    source: orderData.source || 'marketplace'
                });
            }

            // Create order record
            const order = {
                customerId: customer.id,
                streamId: orderData.streamId,
                productId: orderData.productId,
                orderNumber: this.generateOrderNumber(),
                amount: orderData.amount,
                status: orderData.status || 'pending',
                platform: orderData.platform || 'facebook_marketplace',
                shippingAddress: JSON.stringify(orderData.shippingAddress || {}),
                items: JSON.stringify(orderData.items || []),
                notes: orderData.notes || '',
                createdAt: new Date().toISOString()
            };

            const orderId = await this.db.saveOrder(order);

            // Update customer metrics
            await this.updateCustomerMetrics(customer.id);
            
            // Update customer segment
            await this.updateCustomerSegment(customer.id);

            await this.db.log('CustomerManager', 'processOrder', `Processed order ${order.orderNumber} for ${orderData.customerEmail}`);

            return { id: orderId, ...order };
        } catch (error) {
            console.error('Error processing order:', error);
            throw error;
        }
    }

    async updateCustomerMetrics(customerId) {
        try {
            // Get all orders for customer
            const orders = await this.getCustomerOrders(customerId);
            
            if (orders.length === 0) return;

            const totalSpent = orders.reduce((sum, order) => sum + (order.amount || 0), 0);
            const orderCount = orders.length;
            const averageOrderValue = totalSpent / orderCount;
            const lastOrderDate = orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at;

            await this.updateCustomer(customerId, {
                total_spent: totalSpent,
                order_count: orderCount,
                average_order_value: averageOrderValue,
                last_order_date: lastOrderDate
            });

        } catch (error) {
            console.error('Error updating customer metrics:', error);
        }
    }

    async updateCustomerSegment(customerId) {
        try {
            const customer = await this.getCustomerById(customerId);
            if (!customer) return;

            let newSegment = 'regular';

            // Determine segment based on customer data
            if (customer.total_spent >= this.segments.vip.minOrderValue && 
                customer.order_count >= this.segments.vip.minOrders) {
                newSegment = 'vip';
            } else if (customer.total_spent >= this.segments.high_value.minOrderValue && 
                       customer.order_count >= this.segments.high_value.minOrders) {
                newSegment = 'high_value';
            } else if (this.isNewCustomer(customer)) {
                newSegment = 'new';
            } else if (this.isAtRiskCustomer(customer)) {
                newSegment = 'at_risk';
            }

            if (newSegment !== customer.segment) {
                await this.updateCustomer(customerId, { segment: newSegment });
                
                await this.db.log('CustomerManager', 'updateCustomerSegment', 
                    `Customer ${customer.email} moved to ${newSegment} segment`);
            }

        } catch (error) {
            console.error('Error updating customer segment:', error);
        }
    }

    isNewCustomer(customer) {
        const daysSinceFirst = (Date.now() - new Date(customer.created_at)) / (1000 * 60 * 60 * 24);
        return daysSinceFirst <= this.segments.new.maxDaysSinceFirst;
    }

    isAtRiskCustomer(customer) {
        if (!customer.last_order_date || customer.order_count < this.segments.at_risk.minOrders) {
            return false;
        }
        
        const daysSinceLastOrder = (Date.now() - new Date(customer.last_order_date)) / (1000 * 60 * 60 * 24);
        return daysSinceLastOrder >= this.segments.at_risk.daysSinceLastOrder;
    }

    async findCustomerByEmail(email) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM customers WHERE email = ? LIMIT 1`;
            this.db.db.get(sql, [email], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    async getCustomerById(customerId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM customers WHERE id = ? LIMIT 1`;
            this.db.db.get(sql, [customerId], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    async getCustomerOrders(customerId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC`;
            this.db.db.all(sql, [customerId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getCustomersBySegment(segment) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM customers WHERE segment = ? ORDER BY total_spent DESC`;
            this.db.db.all(sql, [segment], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getAllCustomers(limit = 100, offset = 0) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM customers ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            this.db.db.all(sql, [limit, offset], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getCustomerAnalytics() {
        try {
            const analytics = await Promise.all([
                this.getTotalCustomers(),
                this.getNewCustomersThisMonth(),
                this.getAverageOrderValue(),
                this.getCustomerLifetimeValue(),
                this.getSegmentDistribution(),
                this.getTopCustomers(10)
            ]);

            return {
                totalCustomers: analytics[0],
                newCustomersThisMonth: analytics[1],
                averageOrderValue: analytics[2],
                customerLifetimeValue: analytics[3],
                segmentDistribution: analytics[4],
                topCustomers: analytics[5]
            };
        } catch (error) {
            console.error('Error getting customer analytics:', error);
            return null;
        }
    }

    async getTotalCustomers() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) as count FROM customers`;
            this.db.db.get(sql, (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
    }

    async getNewCustomersThisMonth() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) as count FROM customers WHERE created_at >= date('now', 'start of month')`;
            this.db.db.get(sql, (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
    }

    async getAverageOrderValue() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT AVG(amount) as avg FROM orders WHERE status = 'completed'`;
            this.db.db.get(sql, (err, row) => {
                if (err) reject(err);
                else resolve(row.avg || 0);
            });
        });
    }

    async getCustomerLifetimeValue() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT AVG(total_spent) as avg FROM customers WHERE total_spent > 0`;
            this.db.db.get(sql, (err, row) => {
                if (err) reject(err);
                else resolve(row.avg || 0);
            });
        });
    }

    async getSegmentDistribution() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT segment, COUNT(*) as count FROM customers GROUP BY segment`;
            this.db.db.all(sql, (err, rows) => {
                if (err) reject(err);
                else {
                    const distribution = {};
                    rows.forEach(row => {
                        distribution[row.segment] = row.count;
                    });
                    resolve(distribution);
                }
            });
        });
    }

    async getTopCustomers(limit = 10) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM customers ORDER BY total_spent DESC LIMIT ?`;
            this.db.db.all(sql, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async addCustomerNote(customerId, note) {
        try {
            const customer = await this.getCustomerById(customerId);
            if (!customer) return false;

            const existingNotes = customer.notes || '';
            const timestamp = new Date().toISOString();
            const newNote = `[${timestamp}] ${note}`;
            const updatedNotes = existingNotes ? `${existingNotes}\n${newNote}` : newNote;

            return await this.updateCustomer(customerId, { notes: updatedNotes });
        } catch (error) {
            console.error('Error adding customer note:', error);
            return false;
        }
    }

    async addCustomerTag(customerId, tag) {
        try {
            const customer = await this.getCustomerById(customerId);
            if (!customer) return false;

            const tags = JSON.parse(customer.tags || '[]');
            if (!tags.includes(tag)) {
                tags.push(tag);
                return await this.updateCustomer(customerId, { tags: JSON.stringify(tags) });
            }
            return true;
        } catch (error) {
            console.error('Error adding customer tag:', error);
            return false;
        }
    }

    async removeCustomerTag(customerId, tag) {
        try {
            const customer = await this.getCustomerById(customerId);
            if (!customer) return false;

            const tags = JSON.parse(customer.tags || '[]');
            const updatedTags = tags.filter(t => t !== tag);
            
            return await this.updateCustomer(customerId, { tags: JSON.stringify(updatedTags) });
        } catch (error) {
            console.error('Error removing customer tag:', error);
            return false;
        }
    }

    async updateCustomerPreferences(customerId, preferences) {
        try {
            const customer = await this.getCustomerById(customerId);
            if (!customer) return false;

            const existingPrefs = JSON.parse(customer.preferences || '{}');
            const updatedPrefs = { ...existingPrefs, ...preferences };

            return await this.updateCustomer(customerId, { preferences: JSON.stringify(updatedPrefs) });
        } catch (error) {
            console.error('Error updating customer preferences:', error);
            return false;
        }
    }

    generateOrderNumber() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `MRW-${timestamp}-${random}`.toUpperCase();
    }

    async searchCustomers(query, filters = {}) {
        try {
            let sql = `SELECT * FROM customers WHERE 1=1`;
            const params = [];

            // Text search
            if (query) {
                sql += ` AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)`;
                const searchTerm = `%${query}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            // Filters
            if (filters.segment) {
                sql += ` AND segment = ?`;
                params.push(filters.segment);
            }

            if (filters.minSpent) {
                sql += ` AND total_spent >= ?`;
                params.push(filters.minSpent);
            }

            if (filters.maxSpent) {
                sql += ` AND total_spent <= ?`;
                params.push(filters.maxSpent);
            }

            if (filters.dateFrom) {
                sql += ` AND created_at >= ?`;
                params.push(filters.dateFrom);
            }

            if (filters.dateTo) {
                sql += ` AND created_at <= ?`;
                params.push(filters.dateTo);
            }

            sql += ` ORDER BY total_spent DESC LIMIT 100`;

            return new Promise((resolve, reject) => {
                this.db.db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
        } catch (error) {
            console.error('Error searching customers:', error);
            return [];
        }
    }

    async runSegmentationUpdate() {
        try {
            console.log('🎯 Running customer segmentation update...');
            
            const customers = await this.getAllCustomers(1000);
            let updatedCount = 0;

            for (const customer of customers) {
                const oldSegment = customer.segment;
                await this.updateCustomerSegment(customer.id);
                
                const updatedCustomer = await this.getCustomerById(customer.id);
                if (updatedCustomer.segment !== oldSegment) {
                    updatedCount++;
                }
            }

            await this.db.log('CustomerManager', 'runSegmentationUpdate', `Updated ${updatedCount} customer segments`);
            console.log(`✅ Updated ${updatedCount} customer segments`);
            
            return updatedCount;
        } catch (error) {
            console.error('Error running segmentation update:', error);
            return 0;
        }
    }
}

module.exports = CustomerManager;
