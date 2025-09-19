class ProfitTracker {
    constructor(database) {
        this.db = database;
        this.reinvestmentThresholds = {
            minimum_profit: 50,
            reinvestment_percentage: 0.7, // 70% of profits
            emergency_reserve: 0.1, // 10% emergency fund
            scaling_threshold: 200, // Scale when profit > $200
            diversification_threshold: 500 // Diversify when profit > $500
        };
        this.reinvestmentStrategies = [
            'scale_existing_streams',
            'create_new_streams', 
            'increase_marketing_budget',
            'expand_to_new_platforms',
            'improve_product_quality',
            'automate_operations'
        ];
    }

    async calculateStreamProfits() {
        try {
            console.log('💰 Calculating stream profits...');
            
            const streams = await this.db.getIncomeStreams();
            const profitData = [];
            
            for (const stream of streams) {
                const profit = await this.calculateStreamProfit(stream);
                profitData.push(profit);
                
                // Update stream metrics in database
                await this.updateStreamProfitMetrics(stream.id, profit);
            }
            
            await this.db.log('ProfitTracker', 'calculateStreamProfits', `Calculated profits for ${profitData.length} streams`);
            
            return profitData;
        } catch (error) {
            console.error('Error calculating stream profits:', error);
            return [];
        }
    }

    async calculateStreamProfit(stream) {
        try {
            // Get stream orders and calculate revenue
            const orders = await this.getStreamOrders(stream.id);
            const revenue = orders.reduce((sum, order) => sum + (order.amount || 0), 0);
            
            // Calculate expenses
            const expenses = await this.calculateStreamExpenses(stream);
            
            // Calculate profit metrics
            const profit = revenue - expenses.total;
            const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
            const roi = stream.initial_investment > 0 ? (profit / stream.initial_investment) * 100 : 0;
            
            // Calculate growth metrics
            const growthRate = await this.calculateGrowthRate(stream.id);
            
            return {
                streamId: stream.id,
                streamName: stream.name,
                revenue: revenue,
                expenses: expenses,
                profit: profit,
                profitMargin: profitMargin,
                roi: roi,
                growthRate: growthRate,
                initialInvestment: stream.initial_investment || 0,
                daysActive: this.calculateDaysActive(stream.created_at),
                profitPerDay: this.calculateDaysActive(stream.created_at) > 0 ? 
                    profit / this.calculateDaysActive(stream.created_at) : 0
            };
        } catch (error) {
            console.error(`Error calculating profit for stream ${stream.id}:`, error);
            return {
                streamId: stream.id,
                streamName: stream.name,
                revenue: 0,
                expenses: { total: 0 },
                profit: 0,
                profitMargin: 0,
                roi: 0,
                growthRate: 0
            };
        }
    }

    async calculateStreamExpenses(stream) {
        const expenses = {
            initial_investment: stream.initial_investment || 0,
            marketing: 0,
            platform_fees: 0,
            product_costs: 0,
            operational: 0,
            total: 0
        };

        try {
            // Get products for this stream
            const products = await this.getStreamProducts(stream.id);
            
            // Calculate product costs (cost of goods sold)
            const orders = await this.getStreamOrders(stream.id);
            expenses.product_costs = orders.reduce((sum, order) => {
                const product = products.find(p => p.id === order.product_id);
                return sum + (product ? product.cost * (order.quantity || 1) : 0);
            }, 0);
            
            // Estimate platform fees (typically 3-5% of revenue)
            const revenue = orders.reduce((sum, order) => sum + (order.amount || 0), 0);
            expenses.platform_fees = revenue * 0.04; // 4% average
            
            // Estimate marketing costs (10-20% of revenue for new streams)
            const daysActive = this.calculateDaysActive(stream.created_at);
            const marketingRate = daysActive < 30 ? 0.15 : 0.08; // Higher for new streams
            expenses.marketing = revenue * marketingRate;
            
            // Operational costs (hosting, tools, etc.)
            expenses.operational = daysActive * 2; // $2 per day operational cost
            
            expenses.total = expenses.initial_investment + expenses.marketing + 
                           expenses.platform_fees + expenses.product_costs + expenses.operational;
            
            return expenses;
        } catch (error) {
            console.error('Error calculating stream expenses:', error);
            expenses.total = expenses.initial_investment;
            return expenses;
        }
    }

    async calculateGrowthRate(streamId) {
        try {
            // Get revenue for last 7 days vs previous 7 days
            const currentWeekRevenue = await this.getRevenueForPeriod(streamId, 7);
            const previousWeekRevenue = await this.getRevenueForPeriod(streamId, 14, 7);
            
            if (previousWeekRevenue === 0) return 0;
            
            return ((currentWeekRevenue - previousWeekRevenue) / previousWeekRevenue) * 100;
        } catch (error) {
            console.error('Error calculating growth rate:', error);
            return 0;
        }
    }

    async getRevenueForPeriod(streamId, days, offset = 0) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT SUM(amount) as revenue 
                FROM orders 
                WHERE stream_id = ? 
                AND created_at >= date('now', '-${days + offset} days')
                AND created_at < date('now', '-${offset} days')
                AND status = 'completed'
            `;
            this.db.db.get(sql, [streamId], (err, row) => {
                if (err) reject(err);
                else resolve(row.revenue || 0);
            });
        });
    }

    calculateDaysActive(createdAt) {
        return Math.floor((Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24));
    }

    async getStreamOrders(streamId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM orders WHERE stream_id = ? AND status = 'completed'`;
            this.db.db.all(sql, [streamId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getStreamProducts(streamId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM products WHERE stream_id = ?`;
            this.db.db.all(sql, [streamId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async updateStreamProfitMetrics(streamId, profitData) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE income_streams 
                SET revenue = ?, expenses = ?, profit_margin = ?, roi = ?, updated_at = datetime('now')
                WHERE id = ?
            `;
            this.db.db.run(sql, [
                profitData.revenue,
                profitData.expenses.total,
                profitData.profitMargin,
                profitData.roi,
                streamId
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async analyzeReinvestmentOpportunities() {
        try {
            console.log('🔄 Analyzing reinvestment opportunities...');
            
            const profitData = await this.calculateStreamProfits();
            const totalProfit = profitData.reduce((sum, stream) => sum + stream.profit, 0);
            
            if (totalProfit < this.reinvestmentThresholds.minimum_profit) {
                console.log(`💡 Total profit ($${totalProfit.toFixed(2)}) below reinvestment threshold ($${this.reinvestmentThresholds.minimum_profit})`);
                return { shouldReinvest: false, totalProfit, recommendations: [] };
            }

            const availableForReinvestment = totalProfit * this.reinvestmentThresholds.reinvestment_percentage;
            const emergencyReserve = totalProfit * this.reinvestmentThresholds.emergency_reserve;
            
            const recommendations = await this.generateReinvestmentRecommendations(profitData, availableForReinvestment);
            
            await this.db.log('ProfitTracker', 'analyzeReinvestmentOpportunities', 
                `Total profit: $${totalProfit.toFixed(2)}, Available for reinvestment: $${availableForReinvestment.toFixed(2)}`);
            
            return {
                shouldReinvest: true,
                totalProfit,
                availableForReinvestment,
                emergencyReserve,
                recommendations
            };
        } catch (error) {
            console.error('Error analyzing reinvestment opportunities:', error);
            return { shouldReinvest: false, totalProfit: 0, recommendations: [] };
        }
    }

    async generateReinvestmentRecommendations(profitData, budget) {
        const recommendations = [];
        
        try {
            // Sort streams by performance
            const topPerformers = profitData
                .filter(stream => stream.profit > 0 && stream.roi > 50)
                .sort((a, b) => b.roi - a.roi);
            
            const underperformers = profitData
                .filter(stream => stream.profit <= 0 || stream.roi < 20)
                .sort((a, b) => a.roi - b.roi);

            let remainingBudget = budget;

            // 1. Scale top performing streams
            if (topPerformers.length > 0 && remainingBudget > 100) {
                const scaleAmount = Math.min(remainingBudget * 0.4, 300);
                recommendations.push({
                    strategy: 'scale_existing_streams',
                    streamId: topPerformers[0].streamId,
                    streamName: topPerformers[0].streamName,
                    amount: scaleAmount,
                    expectedROI: topPerformers[0].roi * 0.8, // Slightly lower ROI when scaling
                    description: `Scale ${topPerformers[0].streamName} with additional inventory and marketing`,
                    priority: 'high'
                });
                remainingBudget -= scaleAmount;
            }

            // 2. Create new streams from high-potential opportunities
            if (remainingBudget > 150) {
                const opportunities = await this.getHighPotentialOpportunities();
                if (opportunities.length > 0) {
                    const newStreamAmount = Math.min(remainingBudget * 0.3, 200);
                    recommendations.push({
                        strategy: 'create_new_streams',
                        opportunityId: opportunities[0].id,
                        amount: newStreamAmount,
                        expectedROI: opportunities[0].roi_estimate,
                        description: `Create new ${opportunities[0].business_model} stream for ${opportunities[0].keyword}`,
                        priority: 'medium'
                    });
                    remainingBudget -= newStreamAmount;
                }
            }

            // 3. Increase marketing for profitable streams
            if (topPerformers.length > 0 && remainingBudget > 50) {
                const marketingAmount = Math.min(remainingBudget * 0.5, 150);
                recommendations.push({
                    strategy: 'increase_marketing_budget',
                    streamId: topPerformers[0].streamId,
                    streamName: topPerformers[0].streamName,
                    amount: marketingAmount,
                    expectedROI: 200, // Marketing typically has good ROI
                    description: `Increase marketing budget for ${topPerformers[0].streamName}`,
                    priority: 'medium'
                });
                remainingBudget -= marketingAmount;
            }

            // 4. Diversify to new platforms if budget allows
            if (budget > this.reinvestmentThresholds.diversification_threshold && remainingBudget > 100) {
                recommendations.push({
                    strategy: 'expand_to_new_platforms',
                    amount: Math.min(remainingBudget, 200),
                    expectedROI: 150,
                    description: 'Expand successful products to additional marketplaces (eBay, Etsy, etc.)',
                    priority: 'low'
                });
            }

            // 5. Improve underperforming streams
            if (underperformers.length > 0 && remainingBudget > 30) {
                const improvementAmount = Math.min(remainingBudget, 100);
                recommendations.push({
                    strategy: 'improve_product_quality',
                    streamId: underperformers[0].streamId,
                    streamName: underperformers[0].streamName,
                    amount: improvementAmount,
                    expectedROI: 100,
                    description: `Improve ${underperformers[0].streamName} with better products/pricing`,
                    priority: 'low'
                });
            }

            return recommendations.sort((a, b) => {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });

        } catch (error) {
            console.error('Error generating reinvestment recommendations:', error);
            return [];
        }
    }

    async getHighPotentialOpportunities() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM opportunities 
                WHERE status = 'pending' 
                AND profit_potential >= 7 
                AND investment_required <= 200
                ORDER BY profit_potential DESC, roi_estimate DESC
                LIMIT 3
            `;
            this.db.db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async executeReinvestmentPlan(recommendations) {
        try {
            console.log('🚀 Executing reinvestment plan...');
            
            let executedCount = 0;
            let totalInvested = 0;

            for (const recommendation of recommendations) {
                try {
                    const success = await this.executeReinvestmentStrategy(recommendation);
                    if (success) {
                        executedCount++;
                        totalInvested += recommendation.amount;
                        
                        await this.logReinvestment(recommendation);
                    }
                } catch (error) {
                    console.error(`Error executing ${recommendation.strategy}:`, error);
                }
            }

            await this.db.log('ProfitTracker', 'executeReinvestmentPlan', 
                `Executed ${executedCount} strategies, invested $${totalInvested.toFixed(2)}`);
            
            console.log(`✅ Executed ${executedCount} reinvestment strategies, total invested: $${totalInvested.toFixed(2)}`);
            
            return { executedCount, totalInvested };
        } catch (error) {
            console.error('Error executing reinvestment plan:', error);
            return { executedCount: 0, totalInvested: 0 };
        }
    }

    async executeReinvestmentStrategy(recommendation) {
        switch (recommendation.strategy) {
            case 'scale_existing_streams':
                return await this.scaleStream(recommendation);
            
            case 'create_new_streams':
                return await this.createNewStream(recommendation);
            
            case 'increase_marketing_budget':
                return await this.increaseMarketingBudget(recommendation);
            
            case 'expand_to_new_platforms':
                return await this.expandToPlatforms(recommendation);
            
            case 'improve_product_quality':
                return await this.improveProducts(recommendation);
            
            default:
                console.log(`Strategy ${recommendation.strategy} not implemented yet`);
                return false;
        }
    }

    async scaleStream(recommendation) {
        try {
            // Increase stream budget and create additional products
            await this.updateStreamBudget(recommendation.streamId, recommendation.amount);
            
            // Create 2-3 additional products for the stream
            const stream = await this.getStreamById(recommendation.streamId);
            if (stream) {
                const newProducts = await this.createAdditionalProducts(stream, 3);
                console.log(`📈 Scaled ${stream.name} with ${newProducts} new products`);
            }
            
            return true;
        } catch (error) {
            console.error('Error scaling stream:', error);
            return false;
        }
    }

    async createNewStream(recommendation) {
        try {
            // This would integrate with MarketplaceBot to create a new income stream
            console.log(`🆕 Creating new stream for opportunity ${recommendation.opportunityId}`);
            
            // Mark opportunity as being implemented
            await this.updateOpportunityStatus(recommendation.opportunityId, 'implementing');
            
            return true;
        } catch (error) {
            console.error('Error creating new stream:', error);
            return false;
        }
    }

    async increaseMarketingBudget(recommendation) {
        try {
            // Simulate increasing marketing spend
            console.log(`📢 Increased marketing budget for ${recommendation.streamName} by $${recommendation.amount}`);
            
            // Update stream marketing budget
            await this.updateStreamMarketingBudget(recommendation.streamId, recommendation.amount);
            
            return true;
        } catch (error) {
            console.error('Error increasing marketing budget:', error);
            return false;
        }
    }

    async expandToPlatforms(recommendation) {
        try {
            console.log(`🌐 Expanding to new platforms with budget $${recommendation.amount}`);
            // This would integrate with marketplace expansion logic
            return true;
        } catch (error) {
            console.error('Error expanding to platforms:', error);
            return false;
        }
    }

    async improveProducts(recommendation) {
        try {
            console.log(`⬆️ Improving products for ${recommendation.streamName} with $${recommendation.amount}`);
            // This would integrate with product improvement logic
            return true;
        } catch (error) {
            console.error('Error improving products:', error);
            return false;
        }
    }

    async updateStreamBudget(streamId, additionalBudget) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE income_streams 
                SET initial_investment = initial_investment + ?, updated_at = datetime('now')
                WHERE id = ?
            `;
            this.db.db.run(sql, [additionalBudget, streamId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async updateStreamMarketingBudget(streamId, marketingBudget) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE income_streams 
                SET marketing_budget = COALESCE(marketing_budget, 0) + ?, updated_at = datetime('now')
                WHERE id = ?
            `;
            this.db.db.run(sql, [marketingBudget, streamId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async createAdditionalProducts(stream, count) {
        // Simulate creating additional products
        return Math.min(count, 3);
    }

    async getStreamById(streamId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM income_streams WHERE id = ?`;
            this.db.db.get(sql, [streamId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
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

    async logReinvestment(recommendation) {
        try {
            const reinvestment = {
                strategy: recommendation.strategy,
                streamId: recommendation.streamId || null,
                opportunityId: recommendation.opportunityId || null,
                amount: recommendation.amount,
                expectedROI: recommendation.expectedROI,
                description: recommendation.description,
                status: 'executed',
                createdAt: new Date().toISOString()
            };

            await this.db.saveReinvestment(reinvestment);
        } catch (error) {
            console.error('Error logging reinvestment:', error);
        }
    }

    async getFinancialSummary() {
        try {
            const profitData = await this.calculateStreamProfits();
            const totalRevenue = profitData.reduce((sum, stream) => sum + stream.revenue, 0);
            const totalExpenses = profitData.reduce((sum, stream) => sum + stream.expenses.total, 0);
            const totalProfit = totalRevenue - totalExpenses;
            const averageROI = profitData.length > 0 ? 
                profitData.reduce((sum, stream) => sum + stream.roi, 0) / profitData.length : 0;

            return {
                totalRevenue,
                totalExpenses,
                totalProfit,
                averageROI,
                profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
                streamCount: profitData.length,
                profitableStreams: profitData.filter(s => s.profit > 0).length,
                topPerformer: profitData.sort((a, b) => b.profit - a.profit)[0] || null
            };
        } catch (error) {
            console.error('Error getting financial summary:', error);
            return null;
        }
    }

    async runAutomatedReinvestment() {
        try {
            console.log('🔄 Running automated reinvestment analysis...');
            
            const analysis = await this.analyzeReinvestmentOpportunities();
            
            if (analysis.shouldReinvest && analysis.recommendations.length > 0) {
                // Execute high priority recommendations automatically
                const highPriorityRecs = analysis.recommendations.filter(r => r.priority === 'high');
                
                if (highPriorityRecs.length > 0) {
                    const result = await this.executeReinvestmentPlan(highPriorityRecs);
                    console.log(`🎯 Automated reinvestment complete: ${result.executedCount} strategies, $${result.totalInvested.toFixed(2)} invested`);
                    return result;
                }
            }
            
            console.log('💡 No high-priority reinvestment opportunities at this time');
            return { executedCount: 0, totalInvested: 0 };
        } catch (error) {
            console.error('Error running automated reinvestment:', error);
            return { executedCount: 0, totalInvested: 0 };
        }
    }
}

module.exports = ProfitTracker;
