
import * as vscode from 'vscode';
import { AccountManager } from './accountManager';
import { QuotaProvider } from './quotaProvider';
import { QuotaService } from './quotaService';
import { getTranslation } from './translations';
import { HistoryManager } from './historyManager';

let pollingInterval: NodeJS.Timer | undefined;
let lastCheckTime = 0;

export async function activate(context: vscode.ExtensionContext) {
    const quotaService = new QuotaService();
    const accountManager = new AccountManager(context.globalState, context.secrets);
    const historyManager = new HistoryManager(context.globalState);
    const quotaProvider = new QuotaProvider(accountManager);

    const treeView = vscode.window.createTreeView('quotaExplorer', { treeDataProvider: quotaProvider });
    context.subscriptions.push(treeView);
    
    context.subscriptions.push(vscode.window.registerTreeDataProvider('quotaExplorer', quotaProvider));
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'antigravity-quota.showQuickMenu';

    const config = vscode.workspace.getConfiguration('antigravity-quota');
    const enableMonitoring = config.get('enableMonitoring', true);
    const pollingIntervalMs = (config.get('pollingInterval', 30) as number) * 1000;
    const language = config.get('language', 'auto') as string;

    console.log('[Omni-Quota] ' + getTranslation('activating', language));
 
    statusBarItem.text = "$(sync~spin) Omni-Quota: " + getTranslation('activating', language);
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    registerCommands(context, quotaService, quotaProvider, accountManager, statusBarItem, treeView, historyManager);
     
    try {
        quotaProvider.refresh(null, true);
    } catch (e) {
        console.error('[Omni-Quota] Tree view registration failed:', e);
    }

    if (enableMonitoring) {
        updateStatusBar(statusBarItem, {
            quota: { total: 0, remaining: 0, used: 0 },
            models: [],
            name: "Antigravity Connected"
        }, context);
        
        await accountManager.cleanupInvalidAccounts();
        await runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context, historyManager);
        await updateAllAccountsTimes(accountManager, quotaProvider, treeView);
    } else {
        updateStatusBar(statusBarItem, {
            quota: { total: 0, remaining: 0, used: 0 },
            models: [],
            name: "Antigravity Connected"
        }, context);
    }

    if (enableMonitoring) {
        pollingInterval = setInterval(async () => {
            console.log('[Omni-Quota] Periodic check and cleanup...');
            await accountManager.cleanupInvalidAccounts();
            await runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context, historyManager);
            await updateAllAccountsTimes(accountManager, quotaProvider, treeView);
        }, Math.max(10000, pollingIntervalMs / 2));
        
        const timeUpdateInterval = setInterval(() => {
            updateAllAccountsTimes(accountManager, quotaProvider, treeView);
        }, 10000);
        context.subscriptions.push({ dispose: () => clearInterval(timeUpdateInterval) });
    }

    const autoRefreshOnFocus = config.get('autoRefreshOnFocus', false);
    if (autoRefreshOnFocus) {
        context.subscriptions.push(vscode.window.onDidChangeWindowState(state => {
            if (state.focused) {
                runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context, historyManager);
            }
        }));
    }

    console.log('[Omni-Quota] Extension activated successfully!');
}

function registerCommands(
    context: vscode.ExtensionContext,
    quotaService: QuotaService,
    quotaProvider: QuotaProvider,
    accountManager: AccountManager,
    statusBarItem: vscode.StatusBarItem,
    treeView: vscode.TreeView<any>,
    historyManager: HistoryManager
): vscode.Disposable[] {
    const commands = [
        vscode.commands.registerCommand('antigravity-quota.forceRefresh', async () => {
            const config = vscode.workspace.getConfiguration('antigravity-quota');
            const language = config.get('language', 'auto') as string;
            await forceRefresh(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context, historyManager);
            vscode.window.showInformationMessage(getTranslation('refreshSuccess', language));
        }),
        vscode.commands.registerCommand('antigravity-quota.showQuickMenu', async () => {
            const lastCalculatedData = context.workspaceState.get('lastData', null) as any;
            if (lastCalculatedData && lastCalculatedData.models) {
                const config = vscode.workspace.getConfiguration('antigravity-quota');
                const warningThreshold = config.get('warningThreshold', 50) as number;
                const criticalThreshold = config.get('criticalThreshold', 30) as number;
                const showGeminiPro = config.get('showGeminiPro', true) as boolean;
                const showGeminiFlash = config.get('showGeminiFlash', true) as boolean;

                let filteredModels = lastCalculatedData.models;
                if (!showGeminiPro) {
                    filteredModels = filteredModels.filter((m: any) => !m.name.includes('Gemini') || !m.name.includes('Pro'));
                }
                if (!showGeminiFlash) {
                    filteredModels = filteredModels.filter((m: any) => !m.name.includes('Gemini') || !m.name.includes('Flash'));
                }

                const items = filteredModels.map((m: any) => {
                    const color = m.percentage >= warningThreshold ? '$(circle-filled)' : (m.percentage >= criticalThreshold ? '$(warning)' : '$(error)');
                    return {
                        label: `${color} ${m.name}`,
                        description: `${m.percentage}% - ${m.resetTime}`,
                        model: m
                    };
                });

                // Add Support item
                items.push({ label: '', description: '', model: null } as any); // Separator
                items.push({
                    label: `$(heart) ${getTranslation('supportTitle', config.get('language', 'auto'))}`,
                    description: 'paypal.me/RicardoGurrola146',
                    model: { name: 'SUPPORT_ACTION' }
                });

                const selection = await vscode.window.showQuickPick(items, {
                    placeHolder: getTranslation('selectModelToMonitor', config.get('language', 'auto'))
                }) as any;

                if (selection && selection.model) {
                    if (selection.model.name === 'SUPPORT_ACTION') {
                        vscode.env.openExternal(vscode.Uri.parse('https://paypal.me/RicardoGurrola146'));
                        return;
                    }
                    context.workspaceState.update('selectedModel', selection.model.name);
                    updateStatusBar(statusBarItem, lastCalculatedData, context);
                }
            } else {
                const config = vscode.workspace.getConfiguration('antigravity-quota');
                vscode.window.showInformationMessage(getTranslation('waitingForAntigravity', config.get('language', 'auto')));
            }
        }),
        vscode.commands.registerCommand('antigravity-quota.support', () => {
             vscode.env.openExternal(vscode.Uri.parse('https://paypal.me/RicardoGurrola146'));
        }),
        vscode.commands.registerCommand('antigravity-quota.clearAccounts', async () => {
            const config = vscode.workspace.getConfiguration('antigravity-quota');
            const language = config.get('language', 'auto') as string;
            const confirm = await vscode.window.showWarningMessage(
                getTranslation('clearAccountsConfirm', language),
                { modal: true },
                'Yes'
            );
            if (confirm === 'Yes') {
                await accountManager.reset();
                quotaProvider.refresh(null, true);
                updateStatusBar(statusBarItem, null, context);
                vscode.window.showInformationMessage(getTranslation('accountsCleared', language));
            }
        }),
        vscode.commands.registerCommand('antigravity-quota.removeAccount', async () => {
            const config = vscode.workspace.getConfiguration('antigravity-quota');
            const language = config.get('language', 'auto') as string;
            const accounts = accountManager.getAccounts();
            if (accounts.length === 0) {
                vscode.window.showInformationMessage(getTranslation('noAccountsToRemove', language));
                return;
            }
            const items = accounts.map(acc => ({
                label: acc.displayName,
                description: `ID: ${acc.id}`,
                account: acc
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: getTranslation('selectAccountToRemove', language)
            });
            if (selected && selected.account) {
                await accountManager.removeAccount(selected.account.id);
                quotaProvider.refresh(null, false);
                vscode.window.showInformationMessage(getTranslation('accountRemoved', language).replace('{name}', selected.account.displayName));
            }
        }),
        vscode.commands.registerCommand('antigravity-quota.validateAccounts', async () => {
            const config = vscode.workspace.getConfiguration('antigravity-quota');
            const language = config.get('language', 'auto') as string;
            const accounts = accountManager.getAccounts();
            const invalidAccounts = accounts.filter(acc => {
                const invalidNames = ['undefined', 'account', 'Usuario', ''];
                return invalidNames.includes(acc.displayName) ||
                       acc.displayName.trim().length === 0 ||
                       acc.displayName.toLowerCase().includes('undefined');
            });
            
            if (invalidAccounts.length === 0) {
                vscode.window.showInformationMessage(getTranslation('allAccountsValid', language));
            } else {
                const message = getTranslation('invalidAccountsFound', language).replace('{count}', invalidAccounts.length.toString());
                vscode.window.showWarningMessage(message);
            }
        }),
        vscode.commands.registerCommand('antigravity-quota.settings', async () => {
            const config = vscode.workspace.getConfiguration('antigravity-quota');
            const language = config.get('language', 'auto') as string;
            const currentLang = config.get('language', 'auto') as string;
            const items = [
                {
                    label: getTranslation('changeLanguage', language),
                    description: `Current: ${currentLang}`,
                    action: 'language'
                }
            ];
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: getTranslation('extensionSettings', language)
            });
            if (selected?.action === 'language') {
                const langItems = [
                    { label: 'Auto (System)', value: 'auto' },
                    { label: 'English', value: 'en' },
                    { label: 'Español', value: 'es' },
                    { label: 'Русский', value: 'ru' },
                    { label: '中文', value: 'zh' },
                    { label: '한국어', value: 'ko' },
                    { label: '日本語', value: 'ja' },
                    { label: 'Français', value: 'fr' },
                    { label: 'Deutsch', value: 'de' }
                ];
                const langSelected = await vscode.window.showQuickPick(langItems, {
                    placeHolder: getTranslation('selectLanguage', language)
                });
                if (langSelected) {
                    await config.update('language', langSelected.value, vscode.ConfigurationTarget.Global);
                    quotaProvider.refresh(null, true);
                    runCheck(quotaService, quotaProvider, accountManager, statusBarItem, treeView, context, historyManager);
                    vscode.window.showInformationMessage(getTranslation('languageChanged', langSelected.value).replace('{lang}', langSelected.label));
                }
            }
        }),
        vscode.commands.registerCommand('antigravity-quota.updateAllAccounts', async () => {
            await updateAllAccountsTimes(accountManager, quotaProvider, treeView);
        })
    ];

    context.subscriptions.push(...commands);
    return commands;
}

export function deactivate() {
    if (pollingInterval) clearInterval(pollingInterval);
}

async function runCheck(
    service: QuotaService,
    provider: QuotaProvider,
    accountManager: AccountManager,
    statusBar: vscode.StatusBarItem,
    treeView: vscode.TreeView<any>,
    context: vscode.ExtensionContext,
    historyManager: HistoryManager
) {
    const now = Date.now();
    if (now - lastCheckTime < 5000) return;
    lastCheckTime = now;

    const config = vscode.workspace.getConfiguration('antigravity-quota');
    const language = config.get('language', 'auto') as string;

    try {
        const connections = await service.detectAllActiveConnections();

        if (connections.length === 0) {
            updateStatusBar(statusBar, null, context);
            treeView.message = getTranslation('waitingForAntigravity', language);
            provider.refresh(null, false);
            return;
        }

        let primaryInfo: any = null;

        for (const conn of connections) {
            try {
                const status = await service.fetchStatus(conn);

                let quota = { total: 0, remaining: 0, used: 0 };
                let models: any[] = [];
                let realName = "Usuario";
                let userId = 'unknown';

                if (status && status.userStatus) {
                        realName = status.userStatus.name || realName;
                        const email = status.userStatus.email || '';
                        userId = `${conn.initialData?.context?.properties?.installationId || 'unknown'}_${email || realName}`;
                        
                        let configData = status.userStatus.cascadeModelConfigData;
                        if (!configData && status.userStatus.planStatus) {
                            configData = status.userStatus.planStatus.cascadeModelConfigData;
                        }

                        if (configData && Array.isArray(configData.clientModelConfigs)) {
                            const nowCheck = Date.now();
                            models = configData.clientModelConfigs.map((cfg: any) => {
                                let pct = 0;
                                if (cfg.quotaInfo) {
                                  // DEBUG: Log the full quotaInfo to understand available fields
                                  // console.log(`[Omni-Quota] Model ${cfg.label} QuotaInfo:`, JSON.stringify(cfg.quotaInfo, null, 2));
                                  
                                  // Prefer precise calculation if limit and usage are present
                                  if (typeof cfg.quotaInfo.limit === 'number' && typeof cfg.quotaInfo.usage === 'number' && cfg.quotaInfo.limit > 0) {
                                      const rawPct = ((cfg.quotaInfo.limit - cfg.quotaInfo.usage) / cfg.quotaInfo.limit) * 100;
                                      pct = Math.round(rawPct); // Keep as integer for UI consistency, or * 10 / 10 for 1 decimal
                                  } 
                                  // Fallback to remainingFraction if precise usage data is missing
                                  else if (cfg.quotaInfo.remainingFraction !== undefined) {
                                      pct = Math.round(cfg.quotaInfo.remainingFraction * 100);
                                  }
                                }

                                let resetStr = getTranslation('unknown', language);
                                let resetMinutes = 0;

                                // ENFORCE: If 100%, there is no countdown
                                if (pct === 100) {
                                    resetStr = getTranslation('ready', language);
                                    resetMinutes = 0;
                                } else if (cfg.quotaInfo?.resetTime) {
                                    const rt = cfg.quotaInfo.resetTime;
                                    if (typeof rt === 'string' && rt.match(/^\d{4}-\d{2}-\d{2}T/)) {
                                        try {
                                            const reset = new Date(rt);
                                            resetMinutes = Math.floor((reset.getTime() - nowCheck) / 60000);
                                            if (resetMinutes > 0) {
                                                const d = Math.floor(resetMinutes / 1440);
                                                const h = Math.floor((resetMinutes % 1440) / 60);
                                                const m = resetMinutes % 60;
                                                if (d > 0) {
                                                    resetStr = `${getTranslation('in', language)} ${d}d ${h}h ${m}m`;
                                                } else {
                                                    resetStr = `${getTranslation('in', language)} ${h}h ${m}m`;
                                                }
                                            } else {
                                                resetStr = getTranslation('ready', language);
                                                resetMinutes = 0;
                                            }
                                        } catch(e) {
                                            resetStr = rt;
                                        }
                                    } else {
                                        resetStr = rt.toString();
                                    }
                                } else {
                                    resetStr = '--';
                                }

                                let resetTimestamp: number | undefined;
                                if (cfg.quotaInfo?.resetTime && typeof cfg.quotaInfo.resetTime === 'string' && cfg.quotaInfo.resetTime.match(/^\d{4}-\d{2}-\d{2}T/)) {
                                    resetTimestamp = new Date(cfg.quotaInfo.resetTime).getTime();
                                }

                                // RECORD HISTORY SNAPSHOT
                                historyManager.recordSnapshot(userId, cfg.label || cfg.modelOrAlias?.model || 'Model', pct);

                                return {
                                    name: cfg.label || cfg.modelOrAlias?.model || 'Model',
                                    percentage: pct,
                                    resetTime: resetStr,
                                    resetMinutes: resetMinutes,
                                    resetTimestamp: resetTimestamp
                                };
                            }).sort((a: any, b: any) => b.percentage - a.percentage || (a.resetMinutes - b.resetMinutes));
                        }
                }

                const isValidAccount = realName &&
                    realName !== 'undefined' &&
                    realName !== 'account' &&
                    realName.trim().length > 0 &&
                    realName !== 'Usuario' &&
                    models && models.length > 0;

                if (!isValidAccount) {
                    continue;
                }

                const success = await accountManager.updateAccount(userId, {
                    id: userId,
                    displayName: realName,
                    lastActive: Date.now(),
                    quota: quota,
                    models: models,
                    tier: 'Pro',
                    rawContext: {}
                });
                
                if (success) {
                    await accountManager.setAccountSecret(userId, 'csrf', conn.csrfToken);
                }
                
                if (!success) {
                    vscode.window.showWarningMessage(getTranslation('accountLimitReached', language));
                    continue;
                }

                const currentInfo = { quota, models, name: realName };
                setTimeout(() => {
                    updateStatusBar(statusBar, currentInfo, context);
                }, 0);

                if (!primaryInfo) primaryInfo = currentInfo;
            } catch(e: any) {
                console.error(`[Omni-Quota] Error for PID ${conn.pid}:`, e);
            }
        }

        provider.refresh(null, false);
        if (primaryInfo) {
            treeView.message = undefined;
        }

    } catch (error) {
        console.error('[Omni-Quota] RunCheck Global Error:', error);
    }
}

async function forceRefresh(
    service: QuotaService,
    provider: QuotaProvider,
    accountManager: AccountManager,
    statusBar: vscode.StatusBarItem,
    treeView: vscode.TreeView<any>,
    context: vscode.ExtensionContext,
    historyManager: HistoryManager
) {
    lastCheckTime = 0;
    await runCheck(service, provider, accountManager, statusBar, treeView, context, historyManager);
    await updateAllAccountsTimes(accountManager, provider, treeView);
}

async function updateAllAccountsTimes(accountManager: AccountManager, quotaProvider: QuotaProvider, treeView: vscode.TreeView<any>) {
    const accounts = accountManager.getAccounts();
    const now = Date.now();
    let totalChanged = false;
    let accountsUpdated = 0;

    const config = vscode.workspace.getConfiguration('antigravity-quota');
    const language = config.get('language', 'auto') as string;

    for (const acc of accounts) {
        if (!acc.models) continue;
        let accChanged = false;

        for (const model of acc.models) {
            if (model.resetTimestamp) {
                const diffMs = model.resetTimestamp - now;
                const newResetMinutes = Math.max(0, Math.floor(diffMs / 60000));
                
                let newResetStr = "";
                if (newResetMinutes > 0) {
                    const h = Math.floor(newResetMinutes / 60);
                    const m = newResetMinutes % 60;
                    const d = Math.floor(h / 24);
                    if (d > 0) {
                        newResetStr = `${getTranslation('in', language)} ${d}d ${h % 24}h ${m}m`;
                    } else {
                        newResetStr = `${getTranslation('in', language)} ${h}h ${m}m`;
                    }
                } else {
                    newResetStr = getTranslation('ready', language);
                    
                    // Auto-Replenishment Logic
                    // Si el tiempo de reseteo se cumplió, la cuota se restaura automáticamente al 100%.
                    if (model.percentage !== undefined && model.percentage < 100) {
                        model.percentage = 100;
                        accChanged = true;
                    }
                }

                if (model.resetTime !== newResetStr) {
                    model.resetTime = newResetStr;
                    accChanged = true;
                }
            }
        }

        if (accChanged) {
            await accountManager.updateAccount(acc.id, acc);
            totalChanged = true;
            accountsUpdated++;
        }
    }
    
    if (totalChanged) {
        quotaProvider.refresh(null, false);
    }
}

function updateStatusBar(item: vscode.StatusBarItem, info: any, context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('antigravity-quota');
    const language = config.get('language', 'auto') as string;

    item.hide();
    if (!info) {
        item.text = "$(cloud) Omni-Quota: " + getTranslation('onlineNoModels', language);
        item.tooltip = getTranslation('waitingForAntigravity', language);
        item.show();
        return;
    }
    
    context.workspaceState.update('lastData', info);
    
    if (info && info.name && (!info.models || info.models.length === 0)) {
        item.text = "$(person) " + info.name + ": " + getTranslation('connected', language);
        item.tooltip = getTranslation('connectionActive', language);
        item.command = 'antigravity-quota.showQuickMenu';
        item.show();
        return;
    }
    
    if (info && info.models && info.models.length > 0) {
        const selectedModelName = context.workspaceState.get('selectedModel', '');
        let model = info.models.find((m: any) => m.name === selectedModelName);
        if (!model) {
            model = info.models[0];
        }
        
        const color = model.percentage >= 50 ? '🟢' : model.percentage >= 30 ? '🟡' : '🔴';
        item.text = `${color} ${model.name}: ${model.percentage}%`;
        
        const modelsSummary = info.models.slice(0, 8).map((m: any) => {
            const mColor = m.percentage >= 50 ? '🟢' : m.percentage >= 30 ? '🟡' : '🔴';
            return `${mColor} ${m.name}: ${m.percentage}%`;
        }).join('\n');
        
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`### 🌌 ${info.name || 'Account'}\n\n`);
        tooltip.appendMarkdown(`${modelsSummary}\n\n`);
        tooltip.appendMarkdown(`---\n*${getTranslation('currentSessionQuotas', language)}*`);
        
        item.tooltip = tooltip;
        item.command = 'antigravity-quota.showQuickMenu';
        item.show();
    }
}