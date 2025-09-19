const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const natural = require('natural');
const sentiment = require('sentiment');

class TrendScraper {
    constructor(database) {
        this.db = database;
        this.sentiment = new sentiment();
        this.platforms = {
            reddit: 'https://www.reddit.com',
            twitter: 'https://twitter.com/explore',
            tiktok: 'https://www.tiktok.com/discover',
            google: 'https://trends.google.com/trends/trendingsearches/daily'
        };
        this.browser = null;
    }

    async init() {
        this.browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }

    async scrapeAll() {
        console.log('🔍 Starting trend scraping...');
        
        if (!this.browser) {
            await this.init();
        }

        try {
            const results = await Promise.allSettled([
                this.scrapeReddit(),
                this.scrapeGoogleTrends(),
                this.scrapeSocialMedia(),
                this.scrapeEcommerceTrends()
            ]);

            let totalTrends = 0;
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    totalTrends += result.value;
                } else {
                    console.error(`Scraper ${index} failed:`, result.reason);
                }
            });

            await this.db.log('TrendScraper', 'scrapeAll', `Found ${totalTrends} trends`);
            console.log(`✅ Scraping complete. Found ${totalTrends} trends`);
            
            return totalTrends;
        } catch (error) {
            console.error('Scraping error:', error);
            await this.db.log('TrendScraper', 'scrapeAll', error.message, false);
            return 0;
        }
    }

    async scrapeReddit() {
        try {
            const subreddits = [
                'entrepreneur', 'business', 'startups', 'sidehustle',
                'passive_income', 'investing', 'ecommerce', 'dropshipping'
            ];

            let trendCount = 0;
            
            for (const subreddit of subreddits) {
                try {
                    const response = await axios.get(`https://www.reddit.com/r/${subreddit}/hot.json?limit=25`, {
                        headers: {
                            'User-Agent': 'MrWreckins-TrendBot/1.0'
                        }
                    });

                    const posts = response.data.data.children;
                    
                    for (const post of posts) {
                        const postData = post.data;
                        
                        if (postData.score > 50 && postData.num_comments > 10) {
                            const keywords = this.extractKeywords(postData.title + ' ' + postData.selftext);
                            const sentimentScore = this.sentiment.analyze(postData.title).score;
                            
                            for (const keyword of keywords.slice(0, 3)) {
                                await this.saveTrend({
                                    keyword: keyword,
                                    platform: 'reddit',
                                    searchVolume: postData.score,
                                    growthRate: this.calculateGrowthRate(postData.score, postData.num_comments),
                                    competitionLevel: this.assessCompetition(postData.score),
                                    sentimentScore: sentimentScore
                                });
                                trendCount++;
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error scraping r/${subreddit}:`, error.message);
                }
            }

            return trendCount;
        } catch (error) {
            console.error('Reddit scraping error:', error);
            return 0;
        }
    }

    async scrapeGoogleTrends() {
        try {
            // Simulate Google Trends data (in production, use Google Trends API)
            const mockTrends = [
                'AI automation tools', 'sustainable products', 'remote work accessories',
                'health monitoring devices', 'eco-friendly packaging', 'digital wellness',
                'smart home integration', 'personalized nutrition', 'virtual fitness',
                'cryptocurrency tools', 'NFT marketplace', 'blockchain gaming'
            ];

            let trendCount = 0;
            
            for (const trend of mockTrends) {
                const searchVolume = Math.floor(Math.random() * 10000) + 1000;
                const growthRate = (Math.random() * 200) - 50; // -50% to +150%
                
                await this.saveTrend({
                    keyword: trend,
                    platform: 'google',
                    searchVolume: searchVolume,
                    growthRate: growthRate,
                    competitionLevel: this.assessCompetition(searchVolume),
                    sentimentScore: Math.random() * 10 - 5 // -5 to +5
                });
                trendCount++;
            }

            return trendCount;
        } catch (error) {
            console.error('Google Trends scraping error:', error);
            return 0;
        }
    }

    async scrapeSocialMedia() {
        try {
            // Simulate social media trend detection
            const socialTrends = [
                { keyword: 'minimalist lifestyle', platform: 'instagram', engagement: 15000 },
                { keyword: 'productivity hacks', platform: 'tiktok', engagement: 25000 },
                { keyword: 'sustainable fashion', platform: 'pinterest', engagement: 8000 },
                { keyword: 'home organization', platform: 'youtube', engagement: 12000 },
                { keyword: 'plant-based recipes', platform: 'instagram', engagement: 18000 },
                { keyword: 'digital detox', platform: 'twitter', engagement: 6000 }
            ];

            let trendCount = 0;
            
            for (const trend of socialTrends) {
                await this.saveTrend({
                    keyword: trend.keyword,
                    platform: trend.platform,
                    searchVolume: trend.engagement,
                    growthRate: Math.random() * 100 + 20, // 20% to 120% growth
                    competitionLevel: this.assessCompetition(trend.engagement),
                    sentimentScore: Math.random() * 8 + 2 // Positive sentiment 2-10
                });
                trendCount++;
            }

            return trendCount;
        } catch (error) {
            console.error('Social media scraping error:', error);
            return 0;
        }
    }

    async scrapeEcommerceTrends() {
        try {
            // Simulate e-commerce trend detection from various sources
            const ecommerceTrends = [
                'wireless charging stations', 'ergonomic desk accessories', 'pet wellness products',
                'travel organization tools', 'kitchen gadgets 2024', 'fitness tracking devices',
                'outdoor adventure gear', 'smart water bottles', 'portable phone stands',
                'blue light glasses', 'aromatherapy diffusers', 'meal prep containers'
            ];

            let trendCount = 0;
            
            for (const trend of ecommerceTrends) {
                const searchVolume = Math.floor(Math.random() * 5000) + 500;
                const competition = ['low', 'medium', 'high'][Math.floor(Math.random() * 3)];
                
                await this.saveTrend({
                    keyword: trend,
                    platform: 'ecommerce',
                    searchVolume: searchVolume,
                    growthRate: Math.random() * 80 + 10, // 10% to 90% growth
                    competitionLevel: competition,
                    sentimentScore: Math.random() * 6 + 2 // 2-8 positive sentiment
                });
                trendCount++;
            }

            return trendCount;
        } catch (error) {
            console.error('E-commerce scraping error:', error);
            return 0;
        }
    }

    extractKeywords(text) {
        if (!text) return [];
        
        // Clean and tokenize text
        const tokens = natural.WordTokenizer().tokenize(text.toLowerCase());
        
        // Remove stop words and short words
        const stopWords = natural.stopwords;
        const filtered = tokens.filter(word => 
            word.length > 3 && 
            !stopWords.includes(word) &&
            /^[a-zA-Z]+$/.test(word)
        );

        // Get word frequency
        const freq = {};
        filtered.forEach(word => {
            freq[word] = (freq[word] || 0) + 1;
        });

        // Sort by frequency and return top keywords
        return Object.keys(freq)
            .sort((a, b) => freq[b] - freq[a])
            .slice(0, 5);
    }

    calculateGrowthRate(score, comments) {
        // Simple algorithm to estimate growth rate based on engagement
        const engagementRatio = comments / Math.max(score, 1);
        return Math.min(100, engagementRatio * 50 + Math.random() * 20);
    }

    assessCompetition(volume) {
        if (volume < 1000) return 'low';
        if (volume < 5000) return 'medium';
        return 'high';
    }

    async saveTrend(trendData) {
        try {
            await this.db.saveTrend(trendData);
        } catch (error) {
            // Ignore duplicate key errors
            if (!error.message.includes('UNIQUE constraint failed')) {
                console.error('Error saving trend:', error);
            }
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

module.exports = TrendScraper;
