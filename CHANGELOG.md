# Changelog

All notable changes to the **Antigravity Omni-Quota** extension will be documented in this file.

## [1.1.5] - 2026-06-12
### Fixed
- **Real-Time Accuracy**: Restored accurate 0% detection for disabled models or models without remaining tokens (e.g., Claude Opus on free tiers).
- **Active Account Precision**: The extension now directly reads the active VS Code profile (`google_accounts.json`) to pinpoint the `Live 🟢` account, eliminating errors caused by background ghost processes.
- **Logical Ready State**: Models with 100% quota now correctly display `Ready 🟢` and hide the unnecessary reset countdown.

### Improved
- **Clean UI**: Removed non-functional API data (credits, image badges) from the Sidebar to maintain a clean, quota-focused dashboard.

## [1.1.2] - 2026-01-24
### Fixed
- **Percentage Granularity**: Fixed an issue where quotas were shown in 20% steps. Now calculates precise percentages (e.g., 87%) using raw usage/limit data from Antigravity.

## [1.1.1] - 2026-01-10
### Fixed
- Open VSX activation and license metadata refinement.

## [1.0.6] - 2026-01-10

### Fixed
- **Confusing Ready State**: Models that are ready to use no longer show "0%" or an "X" icon. They now correctly display "100%" and a green checkmark.
- **Quota Accuracy**: Doubled the polling frequency and optimized internal checks to ensure quota changes are reflected much faster.

### Added
- **Dynamic Sidebar Colors**: Icons in the sidebar now use colors (Green, Yellow, Orange, Red) to indicate the health of each model's quota at a glance.
- **Expanded Dashboard**: The status bar tooltip now shows up to **8 models** simultaneously (previously 5).

## [1.0.5] - 2026-01-03

### Added
- **Visual Showcase**: Added high-quality screenshots and demonstrations to the README to better showcase the extension's premium UI.
- **Enhanced Branding**: Updated project assets for a better presence in the VS Code Marketplace and Open VSX.

## [1.0.4] - 2026-01-03

### Improved
- **Startup Speed**: Optimized the activation sequence to perform an immediate data fetch and time calculation. Data now appearing as soon as the extension finishes activating, eliminating the initial 15-30 second wait.
- **Activation Lifecycle**: Refined the extension lifecycle to ensure all providers are fully synchronized before the UI is presented.

## [1.0.3] - 2026-01-03

### Fixed
- **Missing Dependency**: Bundled `axios` and other dependencies into a single file to prevent "Module not found" errors on fresh installations.
- **Improved Reliability**: Switched to `esbuild` for production bundling.

## [1.0.2] - 2026-01-03

### Fixed
- **Sidebar Provider Error**: Fixed the "no data provider registered" error by adding explicit activation events (`onView:quotaExplorer`) and redundant provider registration.
- **Activation Reliability**: Improved extension startup sequence to ensure the Quota Explorer is always available.

## [1.0.0] - 2026-01-03

### Added
- **Multi-Account Hub**: Persistence for multiple Antigravity accounts in the sidebar.
- **Zero-Config Scanning**: Automatic detection of Antigravity processes and ports.
- **Real-Time Countdowns**: Relative reset time calculations for all accounts.
- **Premium UI**: Rich Markdown tooltips for the status bar and native Codicons for the tree view.
- **Multi-Language Support**: English, Spanish, Russian, Chinese, Korean, Japanese, French, and German.
- **Documentation**: Comprehensive technical docs and revamped README.
- **Branding**: Official extension icon and professional metadata.

---

*Initial release of the 1.0 stable branch.*
