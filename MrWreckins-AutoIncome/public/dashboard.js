// Dashboard JavaScript for MrWreckins AutoIncome System
class Dashboard {
    constructor() {
        this.socket = null;
        this.charts = {};
        this.currentTab = 'overview';
        this.data = {
            trends: [],
            opportunities: [],
            streams: [],
            products: [],
            customers: []
        };
        
        this.init();
    }

    get apiBase() {
        return (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : '';
    }

    apiUrl(path) {
        const base = this.apiBase.replace(/\/$/, '');
        return `${base}${path}`;
    }

    init() {
        this.initSocket();
        this.initEventListeners();
        this.initCharts();
        this.loadInitialData();
    }

    initSocket() {
        try {
            let wsUrl = '';
            if (typeof window !== 'undefined' && window.WS_BASE_URL) {
                wsUrl = window.WS_BASE_URL;
            } else if (this.apiBase) {
                // Derive WS from API base if provided
                wsUrl = this.apiBase.replace(/^http/, 'ws');
            } else {
                wsUrl = location.origin.replace(/^http/, 'ws');
            }
            this.socket = new WebSocket(wsUrl);

            this.socket.addEventListener('open', () => {
                console.log('Connected to server');
                this.updateSystemStatus('online');
                // Request an initial live stats snapshot
                this.socket.send(JSON.stringify({ type: 'get_live_stats' }));
            });

            this.socket.addEventListener('close', () => {
                console.log('Disconnected from server');
                this.updateSystemStatus('offline');
            });

            this.socket.addEventListener('message', (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    if (payload.type === 'stats_update' || payload.type === 'live_stats') {
                        this.applyStats(payload.data);
                    } else if (payload.type === 'activity') {
                        this.addActivity(payload.data);
                    } else {
                        this.handleDataUpdate(payload);
                    }
                } catch (e) {
                    console.warn('Non-JSON WS message:', event.data);
                }
            });
        } catch (err) {
            console.error('WebSocket init error:', err);
            this.updateSystemStatus('offline');
        }
    }

    initEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const btn = e.target.closest('.nav-tab');
                if (btn && btn.dataset.tab) {
                    this.switchTab(btn.dataset.tab);
                }
            });
        });

        // Button events
        document.getElementById('scanTrendsBtn')?.addEventListener('click', () => {
            this.scanTrends();
        });

        document.getElementById('createStreamBtn')?.addEventListener('click', () => {
            this.showCreateStreamModal();
        });

        document.getElementById('startAutomationBtn')?.addEventListener('click', () => {
            this.startAutomation();
        });

        document.getElementById('pauseAutomationBtn')?.addEventListener('click', () => {
            this.pauseAutomation();
        });

        // Modal events
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });

        // Filter events
        document.getElementById('opportunityFilter')?.addEventListener('change', (e) => {
            this.filterOpportunities(e.target.value);
        });
    }

    initCharts() {
        // Revenue Chart
        const revenueCtx = document.getElementById('revenueChart');
        if (revenueCtx) {
            this.charts.revenue = new Chart(revenueCtx, {
                type: 'line',
                data: {
                    labels: this.getLast30Days(),
                    datasets: [{
                        label: 'Revenue',
                        data: new Array(30).fill(0),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + value;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Stream Performance Chart
        const streamCtx = document.getElementById('streamChart');
        if (streamCtx) {
            this.charts.stream = new Chart(streamCtx, {
                type: 'doughnut',
                data: {
                    labels: ['No Streams Yet'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#e5e7eb']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }
    }

    getLast30Days() {
        const days = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        return days;
    }

    async loadInitialData() {
        try {
            // Load all data types
            await Promise.all([
                this.loadTrends(),
                this.loadOpportunities(),
                this.loadStreams(),
                this.loadProducts(),
                this.loadCustomers()
            ]);
            
            this.updateOverviewMetrics();
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    async loadTrends() {
        try {
            const response = await fetch(this.apiUrl('/api/trends'));
            this.data.trends = await response.json();
            this.renderTrends();
        } catch (error) {
            console.error('Error loading trends:', error);
        }
    }

    async loadOpportunities() {
        try {
            const response = await fetch(this.apiUrl('/api/opportunities'));
            this.data.opportunities = await response.json();
            this.renderOpportunities();
        } catch (error) {
            console.error('Error loading opportunities:', error);
        }
    }

    async loadStreams() {
        try {
            const response = await fetch(this.apiUrl('/api/streams'));
            this.data.streams = await response.json();
            this.renderStreams();
            this.updateStreamChart();
        } catch (error) {
            console.error('Error loading streams:', error);
        }
    }

    async loadProducts() {
        try {
            const response = await fetch(this.apiUrl('/api/products'));
            this.data.products = await response.json();
            this.renderProducts();
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    async loadCustomers() {
        try {
            const response = await fetch(this.apiUrl('/api/customers'));
            this.data.customers = await response.json();
            this.renderCustomers();
        } catch (error) {
            console.error('Error loading customers:', error);
        }
    }

    switchTab(tabName) {
        // Update nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        this.currentTab = tabName;
    }

    renderTrends() {
        const container = document.getElementById('trendsList');
        if (!container) return;

        if (this.data.trends.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-line"></i>
                    <p>No trends found yet. Click "Scan New Trends" to start discovering opportunities!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.data.trends.map(trend => `
            <div class="trend-card">
                <div class="trend-header">
                    <h3>${trend.keyword}</h3>
                    <span class="trend-score">${trend.growth_rate}%</span>
                </div>
                <div class="trend-details">
                    <span class="trend-platform">${trend.platform}</span>
                    <span class="trend-volume">${trend.search_volume} searches</span>
                </div>
                <div class="trend-sentiment ${trend.sentiment_score > 0 ? 'positive' : 'negative'}">
                    Sentiment: ${trend.sentiment_score > 0 ? 'Positive' : 'Negative'}
                </div>
            </div>
        `).join('');
    }

    renderOpportunities() {
        const container = document.getElementById('opportunitiesGrid');
        if (!container) return;

        if (this.data.opportunities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-lightbulb"></i>
                    <p>No opportunities generated yet. Scan trends first to discover business opportunities!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.data.opportunities.map(opp => `
            <div class="opportunity-card" data-id="${opp.id}">
                <div class="opportunity-header">
                    <h3>${opp.business_model.replace('_', ' ').toUpperCase()}</h3>
                    <span class="profit-score">${opp.profit_potential}/10</span>
                </div>
                <div class="opportunity-details">
                    <p><strong>Investment:</strong> $${opp.investment_required}</p>
                    <p><strong>ROI Estimate:</strong> ${opp.roi_estimate}%</p>
                    <p><strong>Market Size:</strong> ${opp.market_size}</p>
                    <p><strong>Difficulty:</strong> ${opp.difficulty_score}/10</p>
                </div>
                <div class="opportunity-actions">
                    <button class="btn btn-primary btn-sm" onclick="dashboard.viewOpportunity(${opp.id})">
                        View Details
                    </button>
                    <button class="btn btn-success btn-sm" onclick="dashboard.implementOpportunity(${opp.id})">
                        Implement
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateOverviewMetrics() {
        const totalRevenue = this.data.streams.reduce((sum, stream) => sum + (stream.revenue || 0), 0);
        const totalExpenses = this.data.streams.reduce((sum, stream) => sum + (stream.expenses || 0), 0);
        const netProfit = totalRevenue - totalExpenses;
        const avgROI = this.data.streams.length > 0 ? 
            this.data.streams.reduce((sum, stream) => sum + (stream.profit_margin || 0), 0) / this.data.streams.length : 0;

        document.getElementById('totalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
        document.getElementById('activeStreams').textContent = this.data.streams.filter(s => s.status === 'active').length;
        document.getElementById('overviewRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
        document.getElementById('overviewProfit').textContent = `$${netProfit.toFixed(2)}`;
        document.getElementById('overviewStreams').textContent = this.data.streams.length;
        document.getElementById('overviewROI').textContent = `${avgROI.toFixed(1)}%`;
    }

    async scanTrends() {
        const btn = document.getElementById('scanTrendsBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
        btn.disabled = true;

        try {
            const response = await fetch(this.apiUrl('/api/scan-trends'), { method: 'POST' });
            let result = {};
            try {
                result = await response.json();
            } catch (_) {}
            
            this.addActivity({
                type: 'trend_scan',
                message: result && typeof result.trendsFound === 'number' 
                    ? `Found ${result.trendsFound} new trends`
                    : (result && result.message ? result.message : 'Trend scan initiated'),
                timestamp: new Date()
            });
            
            await this.loadTrends();
        } catch (error) {
            console.error('Error scanning trends:', error);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    async startAutomation() {
        try {
            const response = await fetch('/api/automation/start', { method: 'POST' });
            const result = await response.json();
            
            this.addActivity({
                type: 'automation',
                message: 'Automation services started',
                timestamp: new Date()
            });
            
            this.updateAutomationStatus();
        } catch (error) {
            console.error('Error starting automation:', error);
        }
    }

    updateSystemStatus(status) {
        const indicator = document.getElementById('systemStatus');
        if (indicator) {
            indicator.innerHTML = status === 'online' ? 
                '<i class="fas fa-circle"></i> Online' : 
                '<i class="fas fa-circle"></i> Offline';
            indicator.className = `stat-value status-indicator ${status}`;
        }
    }

    applyStats(stats) {
        if (!stats) return;
        try {
            // Update header metrics
            const totalRevenue = Number(stats.totalRevenue || 0);
            const activeStreams = Number(stats.activeStreams || 0);
            document.getElementById('totalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
            document.getElementById('activeStreams').textContent = activeStreams;

            // Optionally update overview metrics if charts exist
            document.getElementById('overviewRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
            document.getElementById('overviewStreams').textContent = activeStreams;

            // Push revenue point into chart (shift oldest)
            if (this.charts.revenue) {
                const ds = this.charts.revenue.data.datasets[0].data;
                ds.shift();
                ds.push(totalRevenue);
                this.charts.revenue.update('none');
            }
        } catch (e) {
            console.warn('Failed applying stats:', e);
        }
    }

    addActivity(activity) {
        const list = document.getElementById('activityList');
        if (!list) return;

        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <i class="fas fa-${this.getActivityIcon(activity.type)}"></i>
            <span>${activity.message}</span>
            <time>${this.formatTime(activity.timestamp)}</time>
        `;
        
        list.insertBefore(item, list.firstChild);
        
        // Keep only last 10 activities
        while (list.children.length > 10) {
            list.removeChild(list.lastChild);
        }
    }

    getActivityIcon(type) {
        const icons = {
            trend_scan: 'search',
            opportunity: 'lightbulb',
            stream_created: 'stream',
            automation: 'robot',
            sale: 'dollar-sign'
        };
        return icons[type] || 'info-circle';
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }

    handleDataUpdate(data) {
        if (data.type === 'trends') {
            this.data.trends = data.data;
            this.renderTrends();
        } else if (data.type === 'opportunities') {
            this.data.opportunities = data.data;
            this.renderOpportunities();
        }
        // Handle other data types...
    }

    closeModal(modal) {
        modal.classList.remove('active');
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});

// Add CSS for new components
const additionalCSS = `
.trend-card, .opportunity-card {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: transform 0.3s ease;
}

.trend-card:hover, .opportunity-card:hover {
    transform: translateY(-2px);
}

.trend-header, .opportunity-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.trend-score, .profit-score {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.8rem;
}

.trend-details, .opportunity-details {
    margin-bottom: 1rem;
}

.trend-details span, .opportunity-details p {
    display: block;
    margin-bottom: 0.5rem;
    color: #666;
    font-size: 0.9rem;
}

.opportunity-actions {
    display: flex;
    gap: 0.5rem;
}

.btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
}
`;

// Inject additional CSS
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);
