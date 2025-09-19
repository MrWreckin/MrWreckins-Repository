const OpenAI = require('openai');

class TrendAnalyzer {
    constructor(database) {
        this.db = database;
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || 'demo-key'
        });
        this.businessModels = [
            'dropshipping', 'digital_products', 'print_on_demand', 
            'affiliate_marketing', 'service_arbitrage', 'subscription_box',
            'online_course', 'software_tool', 'marketplace_seller'
        ];
    }

    async analyzeAll() {
        console.log('🧠 Starting AI trend analysis...');
        
        try {
            // Get unanalyzed trends
            const trends = await this.db.getTrends(50);
            const unanalyzed = trends.filter(trend => !trend.analyzed);
            
            if (unanalyzed.length === 0) {
                console.log('No new trends to analyze');
                return 0;
            }

            let analyzedCount = 0;
            
            for (const trend of unanalyzed) {
                try {
                    const opportunities = await this.analyzeTrend(trend);
                    
                    for (const opportunity of opportunities) {
                        await this.db.saveOpportunity({
                            trendId: trend.id,
                            ...opportunity
                        });
                    }
                    
                    // Mark trend as analyzed
                    await this.markTrendAnalyzed(trend.id);
                    analyzedCount++;
                    
                } catch (error) {
                    console.error(`Error analyzing trend ${trend.keyword}:`, error.message);
                }
            }

            await this.db.log('TrendAnalyzer', 'analyzeAll', `Analyzed ${analyzedCount} trends`);
            console.log(`✅ Analysis complete. Generated opportunities for ${analyzedCount} trends`);
            
            return analyzedCount;
        } catch (error) {
            console.error('Trend analysis error:', error);
            await this.db.log('TrendAnalyzer', 'analyzeAll', error.message, false);
            return 0;
        }
    }

    async analyzeTrend(trend) {
        try {
            // Use AI to analyze trend if API key is available
            if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'demo-key') {
                return await this.aiAnalyzeTrend(trend);
            } else {
                return await this.heuristicAnalyzeTrend(trend);
            }
        } catch (error) {
            console.error(`Error in trend analysis for ${trend.keyword}:`, error);
            return await this.heuristicAnalyzeTrend(trend);
        }
    }

    async aiAnalyzeTrend(trend) {
        const prompt = `
Analyze this trending topic for business opportunities:

Keyword: ${trend.keyword}
Platform: ${trend.platform}
Search Volume: ${trend.search_volume}
Growth Rate: ${trend.growth_rate}%
Competition: ${trend.competition_level}
Sentiment: ${trend.sentiment_score}

Generate 2-3 specific business opportunities. For each opportunity, provide:
1. Business model (dropshipping, digital_products, print_on_demand, etc.)
2. Profit potential (1-10 scale)
3. Difficulty score (1-10, where 1 is easiest)
4. Investment required ($0-$1000)
5. ROI estimate (percentage)
6. Market size (small/medium/large)
7. Competition analysis (brief)
8. Specific recommendation

Format as JSON array with these exact fields:
[{
  "businessModel": "",
  "profitPotential": 0,
  "difficultyScore": 0,
  "investmentRequired": 0,
  "roiEstimate": 0,
  "marketSize": "",
  "competitionAnalysis": "",
  "aiRecommendation": ""
}]
`;

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 1000
            });

            const content = response.choices[0].message.content;
            const opportunities = JSON.parse(content);
            
            return opportunities.map(opp => ({
                ...opp,
                profitPotential: Math.min(10, Math.max(1, opp.profitPotential)),
                difficultyScore: Math.min(10, Math.max(1, opp.difficultyScore)),
                investmentRequired: Math.min(1000, Math.max(0, opp.investmentRequired))
            }));
            
        } catch (error) {
            console.error('OpenAI API error:', error.message);
            return await this.heuristicAnalyzeTrend(trend);
        }
    }

    async heuristicAnalyzeTrend(trend) {
        const opportunities = [];
        
        // Calculate base scores
        const volumeScore = this.normalizeScore(trend.search_volume, 0, 10000);
        const growthScore = this.normalizeScore(trend.growth_rate, -50, 150);
        const sentimentScore = this.normalizeScore(trend.sentiment_score, -5, 10);
        const competitionPenalty = trend.competition_level === 'high' ? 0.7 : 
                                  trend.competition_level === 'medium' ? 0.85 : 1.0;

        // Generate opportunities based on keyword analysis
        const keywordLower = trend.keyword.toLowerCase();
        
        // Dropshipping opportunity
        if (this.isPhysicalProduct(keywordLower)) {
            opportunities.push({
                businessModel: 'dropshipping',
                profitPotential: Math.round((volumeScore + growthScore) * competitionPenalty * 0.8),
                difficultyScore: trend.competition_level === 'high' ? 7 : 
                               trend.competition_level === 'medium' ? 5 : 3,
                investmentRequired: Math.round(50 + (volumeScore * 20)),
                roiEstimate: Math.round(150 + (growthScore * 50)),
                marketSize: this.assessMarketSize(trend.search_volume),
                competitionAnalysis: `${trend.competition_level} competition with ${trend.search_volume} search volume`,
                aiRecommendation: `Start dropshipping ${trend.keyword} products on Facebook Marketplace. Focus on trending variations and bundle deals.`
            });
        }

        // Digital products opportunity
        if (this.isDigitalOpportunity(keywordLower)) {
            opportunities.push({
                businessModel: 'digital_products',
                profitPotential: Math.round((sentimentScore + growthScore) * 0.9),
                difficultyScore: 4,
                investmentRequired: Math.round(10 + (volumeScore * 5)),
                roiEstimate: Math.round(200 + (growthScore * 30)),
                marketSize: this.assessMarketSize(trend.search_volume),
                competitionAnalysis: `Digital market with ${trend.platform} trending potential`,
                aiRecommendation: `Create digital guides, templates, or courses about ${trend.keyword}. High profit margins with minimal investment.`
            });
        }

        // Print on demand opportunity
        if (this.isPrintOnDemandViable(keywordLower)) {
            opportunities.push({
                businessModel: 'print_on_demand',
                profitPotential: Math.round((volumeScore + sentimentScore) * 0.7),
                difficultyScore: 3,
                investmentRequired: 0,
                roiEstimate: Math.round(120 + (growthScore * 20)),
                marketSize: this.assessMarketSize(trend.search_volume),
                competitionAnalysis: `Creative market opportunity with ${trend.competition_level} design competition`,
                aiRecommendation: `Design ${trend.keyword} themed merchandise. Target trending hashtags and communities.`
            });
        }

        // Service arbitrage opportunity
        if (this.isServiceOpportunity(keywordLower)) {
            opportunities.push({
                businessModel: 'service_arbitrage',
                profitPotential: Math.round((volumeScore + growthScore) * 0.85),
                difficultyScore: 6,
                investmentRequired: Math.round(100 + (volumeScore * 10)),
                roiEstimate: Math.round(180 + (growthScore * 40)),
                marketSize: this.assessMarketSize(trend.search_volume),
                competitionAnalysis: `Service market with local and remote opportunities`,
                aiRecommendation: `Offer ${trend.keyword} services by outsourcing to freelancers. Focus on quality and fast delivery.`
            });
        }

        return opportunities.filter(opp => opp.profitPotential >= 3);
    }

    isPhysicalProduct(keyword) {
        const physicalIndicators = [
            'gadget', 'tool', 'device', 'accessory', 'equipment', 'gear',
            'bottle', 'stand', 'holder', 'organizer', 'container', 'kit',
            'charger', 'cable', 'case', 'cover', 'mount', 'adapter'
        ];
        return physicalIndicators.some(indicator => keyword.includes(indicator));
    }

    isDigitalOpportunity(keyword) {
        const digitalIndicators = [
            'guide', 'course', 'tutorial', 'template', 'planner', 'tracker',
            'hack', 'tip', 'strategy', 'method', 'system', 'blueprint',
            'checklist', 'worksheet', 'ebook', 'pdf'
        ];
        return digitalIndicators.some(indicator => keyword.includes(indicator));
    }

    isPrintOnDemandViable(keyword) {
        const podIndicators = [
            'lifestyle', 'motivation', 'quote', 'design', 'art', 'style',
            'fashion', 'trend', 'aesthetic', 'vintage', 'minimalist'
        ];
        return podIndicators.some(indicator => keyword.includes(indicator));
    }

    isServiceOpportunity(keyword) {
        const serviceIndicators = [
            'consulting', 'coaching', 'training', 'setup', 'installation',
            'optimization', 'management', 'analysis', 'audit', 'review'
        ];
        return serviceIndicators.some(indicator => keyword.includes(indicator));
    }

    normalizeScore(value, min, max) {
        return Math.max(1, Math.min(10, Math.round(((value - min) / (max - min)) * 9 + 1)));
    }

    assessMarketSize(searchVolume) {
        if (searchVolume < 1000) return 'small';
        if (searchVolume < 5000) return 'medium';
        return 'large';
    }

    async markTrendAnalyzed(trendId) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE trends SET analyzed = TRUE WHERE id = ?`;
            this.db.db.run(sql, [trendId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getTopOpportunities(limit = 10) {
        try {
            const opportunities = await this.db.getOpportunities(limit);
            return opportunities.sort((a, b) => b.profit_potential - a.profit_potential);
        } catch (error) {
            console.error('Error getting top opportunities:', error);
            return [];
        }
    }

    async generateBusinessPlan(opportunityId) {
        try {
            const opportunity = await this.getOpportunityById(opportunityId);
            if (!opportunity) return null;

            const plan = {
                opportunityId: opportunityId,
                businessModel: opportunity.business_model,
                timeline: this.generateTimeline(opportunity),
                budget: this.generateBudget(opportunity),
                marketingStrategy: this.generateMarketingStrategy(opportunity),
                riskAssessment: this.generateRiskAssessment(opportunity),
                successMetrics: this.generateSuccessMetrics(opportunity)
            };

            return plan;
        } catch (error) {
            console.error('Error generating business plan:', error);
            return null;
        }
    }

    generateTimeline(opportunity) {
        const baseTime = opportunity.difficulty_score * 3; // days
        return {
            setup: `${Math.max(1, Math.floor(baseTime * 0.3))} days`,
            launch: `${Math.max(3, Math.floor(baseTime * 0.7))} days`,
            optimization: `${Math.max(7, baseTime)} days`,
            scaling: `${Math.max(14, baseTime * 2)} days`
        };
    }

    generateBudget(opportunity) {
        const investment = opportunity.investment_required;
        return {
            initial: investment,
            marketing: Math.round(investment * 0.4),
            operations: Math.round(investment * 0.3),
            contingency: Math.round(investment * 0.3)
        };
    }

    generateMarketingStrategy(opportunity) {
        const strategies = {
            dropshipping: 'Facebook Marketplace + Instagram ads targeting trending hashtags',
            digital_products: 'Content marketing + email sequences + affiliate partnerships',
            print_on_demand: 'Social media organic + influencer collaborations',
            service_arbitrage: 'Local SEO + networking + referral programs'
        };
        
        return strategies[opportunity.business_model] || 'Multi-channel digital marketing approach';
    }

    generateRiskAssessment(opportunity) {
        const risks = [];
        
        if (opportunity.difficulty_score > 7) {
            risks.push('High complexity may require specialized skills');
        }
        
        if (opportunity.investment_required > 500) {
            risks.push('Significant upfront investment required');
        }
        
        if (opportunity.market_size === 'small') {
            risks.push('Limited market size may restrict growth');
        }
        
        return risks.length > 0 ? risks : ['Low risk opportunity with manageable challenges'];
    }

    generateSuccessMetrics(opportunity) {
        return {
            revenue: `$${opportunity.investment_required * (opportunity.roi_estimate / 100)} in first month`,
            customers: `${Math.max(10, opportunity.profit_potential * 5)} customers`,
            conversion: `${Math.max(2, 10 - opportunity.difficulty_score)}% conversion rate`,
            roi: `${opportunity.roi_estimate}% ROI target`
        };
    }

    async getOpportunityById(id) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM opportunities WHERE id = ?`;
            this.db.db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

module.exports = TrendAnalyzer;
