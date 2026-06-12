import * as vscode from 'vscode';
import { AnalyticsService } from '../analyticsService';
import { getTranslation } from '../translations';

export class DashboardPanel {
    public static currentPanel: DashboardPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    // Track Chart.js CDN (or bundle it later)
    private static readonly CHART_JS_URI = 'https://cdn.jsdelivr.net/npm/chart.js';

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, private analyticsService: AnalyticsService) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();
        
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public static createOrShow(extensionUri: vscode.Uri, analyticsService: AnalyticsService) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(column);
            DashboardPanel.currentPanel._update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'antigravityDashboard',
            'Antigravity Analytics',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri, analyticsService);
    }

    public dispose() {
        DashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }

    private async _update() {
        const data = await this.analyticsService.getDashboardData();
        const config = vscode.workspace.getConfiguration('antigravity-quota');
        const language = config.get('language', 'auto') as string;
        
        this._panel.webview.html = this._getHtmlForWebview(data, language);
    }

    private _getHtmlForWebview(data: any, language: string): string {
        const isEs = language === 'es' || language === 'auto';
        const text = {
            title: isEs ? "Panel de Análisis de Cuota" : "Quota Analytics Dashboard",
            summary: isEs ? "Resumen de Rendimiento" : "Performance Overview",
            totalUsed: isEs ? "Total de 'Recargas' Consumidas" : "Total Quota Refills",
            totalUsedDesc: isEs ? "1 Recarga = 100% de uso de un modelo" : "1 Refill = 100% of a Limit Pool",
            mostUsed: isEs ? "Modelo Más Usado" : "Most Used Model",
            efficiency: isEs ? "Velocidad Diaria" : "Daily Velocity",
            efficiencyDesc: isEs ? "Recargas / Día Activo" : "Refills / Active Day",
            trends: isEs ? "Tendencias de Consumo" : "Consumption Trends",
            distribution: isEs ? "Distribución por Modelo" : "Model Distribution",
            accounts: isEs ? "Uso por Cuenta" : "Usage by Account",
            sessionHealth: isEs ? "Memoria de la Conversación Actual (Contexto)" : "Active Conversation Memory (Context)",
            msgs: isEs ? "Mensajes" : "Messages",
            tokens: isEs ? "Tokens" : "Tokens",
            limit: isEs ? "Límite" : "Limit",
            contextWarning: isEs ? "Al llegar al 100%, el modelo empezará a 'olvidar' el inicio del chat." : "At 100%, the model will start 'forgetting' the beginning of the chat.",
            trendDesc: isEs ? "Muestra cómo consumes tus 'Recargas' a lo largo del tiempo." : "Shows how you consume your 'Refills' over time.",
            distDesc: isEs ? "Distribución del uso real por modelo específico." : "Actual usage distribution by specific model.",
            accDesc: isEs ? "Uso dividido por cuenta vinculada." : "Usage split by linked account.",
            mirrorNote: isEs ? "*Nota: Si usas múltiples cuentas, es normal ver patrones idénticos ya que Antigravity las sincroniza." : "*Note: If you use multiple accounts, identical patterns are normal as Antigravity syncs them."
        };

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Antigravity Dashboard</title>
            <script src="${DashboardPanel.CHART_JS_URI}"></script>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); }
                .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
                .card { background: var(--vscode-sideBar-background); border: 1px solid var(--vscode-widget-border); padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .card h3 { margin-top: 0; opacity: 0.7; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
                .metric { font-size: 2.5em; font-weight: 300; color: var(--vscode-textLink-foreground); }
                .sub-metric { font-size: 0.8em; opacity: 0.6; margin-top: 5px; }
                .desc-text { font-size: 0.85em; opacity: 0.5; margin-bottom: 15px; font-style: italic; }
                .chart-container { position: relative; height: 350px; width: 100%; }
                .row { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }
                .col { flex: 1; min-width: 350px; }
                h1 { margin-bottom: 30px; font-weight: 200; font-size: 2em; border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 10px; }
                .warning-text { color: var(--vscode-charts-orange); font-size: 0.85em; margin-top: 10px; font-style: italic; }
                .tooltip-trigger { cursor: help; border-bottom: 1px dotted var(--vscode-textLink-foreground); }
            </style>
        </head>
        <body>
            <h1>${text.title}</h1>
            
            <div class="grid">
                <div class="card">
                    <h3 class="tooltip-trigger" title="${text.totalUsedDesc}">${text.totalUsed}</h3>
                    <div class="metric">${data.summary.totalUsage}</div>
                    <div class="sub-metric">${text.totalUsedDesc}</div>
                </div>
                <div class="card">
                    <h3>${text.mostUsed}</h3>
                    <div class="metric" style="font-size: 1.8em">${data.summary.mostUsedModel}</div>
                </div>
                <div class="card">
                    <h3 class="tooltip-trigger" title="${text.efficiencyDesc}">${text.efficiency}</h3>
                    <div class="metric">${data.summary.efficiencyScore}</div>
                    <div class="sub-metric">${text.efficiencyDesc}</div>
                </div>
            </div>

            ${data.activeContext ? `
            <div class="row">
                <div class="col card" style="flex: 100%;">
                    <h3>${text.sessionHealth}</h3>
                    <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap;">
                        <div class="metric">
                            ${((data.activeContext.currentTokens / data.activeContext.tokenLimit) * 100).toFixed(1)}%
                        </div>
                        <div class="sub-metric" style="font-size: 1.2em; opacity: 0.8;">
                            ${data.activeContext.currentTokens.toLocaleString()} / ${data.activeContext.tokenLimit.toLocaleString()} ${text.tokens}
                        </div>
                        <div class="sub-metric" style="font-size: 1.2em; opacity: 0.8;">
                            ${data.activeContext.messageCount} ${text.msgs}
                        </div>
                    </div>
                    <div style="width: 100%; height: 12px; background: #333; border-radius: 6px; margin-top: 15px; overflow: hidden; border: 1px solid #444;">
                        <div style="width: ${(data.activeContext.currentTokens / data.activeContext.tokenLimit) * 100}%; height: 100%; background: var(--vscode-charts-blue); border-radius: 6px;"></div>
                    </div>
                    <div class="warning-text">${text.contextWarning}</div>
                </div>
            </div>
            ` : ''}

            <div class="row">
                <div class="col card">
                    <h3>${text.trends}</h3>
                    <div class="desc-text">${text.trendDesc}</div>
                    <div class="chart-container">
                        <canvas id="trendChart"></canvas>
                    </div>
                </div>
                <div class="col card">
                    <h3>${text.distribution}</h3>
                    <div class="desc-text">${text.distDesc}</div>
                    <div class="chart-container">
                        <canvas id="distChart"></canvas>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col card" style="flex: 100%;">
                    <h3>${text.accounts}</h3>
                    <div class="desc-text">${text.accDesc}</div>
                    <div class="chart-container" style="height: 250px;">
                        <canvas id="accountChart"></canvas>
                    </div>
                    <div class="desc-text" style="text-align: right; margin-top: 10px;">${text.mirrorNote}</div>
                </div>
            </div>

            <script>
                const data = ${JSON.stringify(data)};
                
                const colors = [
                    '#3794ff', '#ff8c00', '#2ea043', '#f85149', '#8957e5', 
                    '#79c0ff', '#ffa657', '#56d364', '#fa7970', '#d2a8ff'
                ];
                
                Chart.defaults.color = '#cccccc';
                Chart.defaults.borderColor = '#444444';

                // Trend Chart
                new Chart(document.getElementById('trendChart'), {
                    type: 'line',
                    data: {
                        ...data.trends,
                        datasets: data.trends.datasets.map((ds, i) => ({
                            ...ds,
                            borderColor: colors[i % colors.length],
                            backgroundColor: colors[i % colors.length] + '33',
                            fill: true
                        }))
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return context.dataset.label + ': ' + context.parsed.y + ' Recargas';
                                    }
                                }
                            },
                            legend: { position: 'bottom' }
                        },
                        scales: {
                            y: { 
                                beginAtZero: true, 
                                title: { display: true, text: 'Recargas de Cuota (1 = 100%)' }
                            },
                            x: { grid: { display: false } }
                        }
                    }
                });

                // Distribution Chart
                new Chart(document.getElementById('distChart'), {
                    type: 'doughnut',
                    data: {
                        ...data.distribution,
                        datasets: [{
                            data: data.distribution.data,
                            backgroundColor: colors,
                            borderWidth: 1,
                            borderColor: 'var(--vscode-sideBar-background)'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'right' },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const val = context.parsed;
                                        const total = context.chart._metasets[context.datasetIndex].total;
                                        const pct = ((val / total) * 100).toFixed(1) + '%';
                                        return context.label + ': ' + val + ' Recargas (' + pct + ')';
                                    }
                                }
                            }
                        }
                    }
                });

                 // Account Chart (Bar)
                new Chart(document.getElementById('accountChart'), {
                    type: 'bar',
                    data: {
                        ...data.accounts,
                        datasets: [{
                            data: data.accounts.data,
                            backgroundColor: colors[0] + 'aa',
                            borderColor: colors[0],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y', // Horizontal Bar
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return context.raw + ' Recargas';
                                    }
                                }
                            }
                        },
                        scales: {
                            x: { beginAtZero: true, title: { display: true, text: 'Recargas Totales' } }
                        }
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
