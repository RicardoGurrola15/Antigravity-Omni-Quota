import { HistoryManager, QuotaSnapshot } from './historyManager';
import { AccountManager } from './accountManager';

export interface DashboardData {
    summary: {
        totalUsage: number;
        mostUsedModel: string;
        efficiencyScore: number; // Tokens per session/hour approximation
    };
    trends: {
        labels: string[]; // Dates
        datasets: {
            label: string; // Model Name
            data: number[]; // Usage points
        }[];
    };
    distribution: {
        labels: string[];
        data: number[];
    };
    accounts: {
        labels: string[];
        data: number[];
    };
    activeContext?: {
        currentTokens: number;
        tokenLimit: number;
        messageCount: number;
    };
}

export class AnalyticsService {
    constructor(private historyManager: HistoryManager, private accountManager?: AccountManager) {}

    public async getDashboardData(): Promise<DashboardData> {
        const history = this.historyManager.getHistory();
        
        // Find most recent account precision info
        let activeContext = undefined;
        if (this.accountManager) {
            const accounts = this.accountManager.getAccounts();
            if (accounts.length > 0) {
                // Find first account with precisionInfo
                const accWithInfo = accounts.find((a: any) => a.precisionInfo);
                if (accWithInfo) {
                    activeContext = (accWithInfo as any).precisionInfo;
                }
            }
        }
        
        // 1. Sort by timestamp (asc)
        history.sort((a, b) => a.timestamp - b.timestamp);

        // 2. Structures for aggregation
        const poolTotalUsage: Record<string, number> = {}; // Usage by Pool (Premium, Pro, Flash)
        const accountTotalUsage: Record<string, number> = {};
        const dailyUsage: Record<string, Record<string, number>> = {}; // date -> pool -> usage
        let globalTotalUsage = 0;

        // Simplified grouping: Just keep the raw name for the charts
        const getPool = (model: string): string => {
            return model;
        };

        // 3. Process Deltas (Global Cross-Account Deduplication)
        // Group all snapshots into global 10s buckets to detect simultaneous drops across all accounts.
        const globalTimeBuckets: Record<number, Record<string, Record<string, number>>> = {}; // bucketId -> accountId -> model -> percentage
        
        history.forEach(s => {
            const bucketId = Math.floor(s.timestamp / 10000) * 10000;
            if (!globalTimeBuckets[bucketId]) globalTimeBuckets[bucketId] = {};
            if (!globalTimeBuckets[bucketId][s.accountId]) globalTimeBuckets[bucketId][s.accountId] = {};
            globalTimeBuckets[bucketId][s.accountId][s.modelName] = s.percentage;
        });

        const sortedBuckets = Object.keys(globalTimeBuckets).map(Number).sort((a, b) => a - b);
        
        // Track the last seen percentage for each (account, model) to detect deltas accurately
        const lastPercentages: Record<string, Record<string, number>> = {};

        for (let i = 0; i < sortedBuckets.length; i++) {
            const bucketId = sortedBuckets[i];
            const accountStates = globalTimeBuckets[bucketId];
            
            // For this time slice, find all unique model drops
            const modelDeltasInBucket: Record<string, { delta: number, accountId: string }> = {};

            for (const accountId in accountStates) {
                const modelStates = accountStates[accountId];
                if (!lastPercentages[accountId]) lastPercentages[accountId] = {};

                for (const model in modelStates) {
                    const currentPct = modelStates[model];
                    const prevPct = lastPercentages[accountId][model];

                    if (prevPct !== undefined && currentPct < prevPct) {
                        const delta = prevPct - currentPct;
                        // Deduplicate: If multiple accounts report a drop for the same model, 
                        // only record the one with the largest delta (should be identical anyway)
                        if (!modelDeltasInBucket[model] || delta > modelDeltasInBucket[model].delta) {
                            modelDeltasInBucket[model] = { delta, accountId };
                        }
                    }
                    lastPercentages[accountId][model] = currentPct;
                }
            }

            // Apply deduplicated deltas to global stats
            for (const model in modelDeltasInBucket) {
                const { delta, accountId } = modelDeltasInBucket[model];
                
                if (!poolTotalUsage[model]) poolTotalUsage[model] = 0;
                poolTotalUsage[model] += delta;

                const accName = accountId.split('_').slice(1).join('_') || 'Unknown';
                if (!accountTotalUsage[accName]) accountTotalUsage[accName] = 0;
                accountTotalUsage[accName] += delta;

                globalTotalUsage += delta;

                const dateStr = new Date(bucketId).toLocaleDateString();
                if (!dailyUsage[dateStr]) dailyUsage[dateStr] = {};
                if (!dailyUsage[dateStr][model]) dailyUsage[dateStr][model] = 0;
                dailyUsage[dateStr][model] += delta;
            }
        }

        // 4. Determine Most Used Pool
        let mostUsedPool = "None";
        let maxUsage = -1;
        for (const p in poolTotalUsage) {
            if (poolTotalUsage[p] > maxUsage) {
                maxUsage = poolTotalUsage[p];
                mostUsedPool = p;
            }
        }

        // 5. Format Trends
        const uniqueDates = Object.keys(dailyUsage).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        const uniquePools = Object.keys(poolTotalUsage);
        
        const trendDatasets = uniquePools.map(pool => {
            return {
                label: pool,
                data: uniqueDates.map(date => {
                     const points = dailyUsage[date][pool] || 0;
                     return parseFloat((points / 100).toFixed(2)); 
                }),
                tension: 0.3
            };
        });

        // 6. Format Distribution (By Pool)
        const distEntries = Object.entries(poolTotalUsage)
            .sort((a, b) => b[1] - a[1])
            .map(([pool, usage]) => {
                return { 
                    pool, 
                    usage: parseFloat((usage / 100).toFixed(2))
                };
            });
        const distLabels = distEntries.map(e => e.pool);
        const distData = distEntries.map(e => e.usage);

        // 7. Accounts
        const accountDistEntries = Object.entries(accountTotalUsage)
            .sort((a, b) => b[1] - a[1])
            .map(([acc, usage]) => {
                return {
                    account: acc,
                    usage: parseFloat((usage / 100).toFixed(2))
                };
            });

        const totalCycles = parseFloat((globalTotalUsage / 100).toFixed(2));

        return {
            summary: {
                totalUsage: totalCycles,
                mostUsedModel: mostUsedPool,
                efficiencyScore: history.length > 0 ? parseFloat((totalCycles / (uniqueDates.length || 1)).toFixed(2)) : 0
            },
            trends: {
                labels: uniqueDates,
                datasets: trendDatasets
            },
            distribution: {
                labels: distLabels,
                data: distData
            },
            accounts: {
                labels: accountDistEntries.map(e => e.account),
                data: accountDistEntries.map(e => e.usage)
            },
            activeContext
        };
    }
    
    // Helper to aggregate data...
}
