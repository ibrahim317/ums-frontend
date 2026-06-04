import { appState } from './AppState.js';

/**
 * UpdaterService - Manages OTA App Update checks from GitHub, coordinates with the
 * Capacitor AppUpdater plugin, and controls modal / page progress bars.
 */
export class UpdaterService {
    constructor() {
        this.fetchedVersion = null;
        this.initProgressListeners();
    }

    /**
     * Helper to compare version numbers (e.g. 1.0.2 vs 1.0.1).
     */
    isNewerVersion(latest, current) {
        const parse = (v) => v.replace(/^v/i, '').split('.').map(Number);
        const lParts = parse(latest);
        const cParts = parse(current);
        for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
            const l = lParts[i] || 0;
            const c = cParts[i] || 0;
            if (l > c) return true;
            if (l < c) return false;
        }
        return false;
    }

    /**
     * Listens to the Capacitor AppUpdater plugin download progress.
     */
    initProgressListeners() {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AppUpdater) {
            try {
                window.Capacitor.Plugins.AppUpdater.addListener('downloadProgress', (info) => {
                    const progress = info.progress || 0;
                    this.updateProgressUI(progress);
                });
            } catch (e) {
                console.error('Failed to register download progress listener:', e);
            }
        }
    }

    /**
     * Updates download progress bar widths and texts.
     */
    updateProgressUI(progress) {
        // Update modal progress elements
        const modalProgressContainer = document.getElementById('update-progress-container');
        const modalProgressText = document.getElementById('update-progress-text');
        const modalProgressBar = document.getElementById('update-progress-bar');

        if (modalProgressContainer && modalProgressText && modalProgressBar) {
            modalProgressContainer.classList.remove('hidden');
            modalProgressText.textContent = `${progress}%`;
            modalProgressBar.style.width = `${progress}%`;
        }

        // Update settings page progress elements
        const settingsProgressContainer = document.getElementById('settings-update-progress-container');
        const settingsProgressText = document.getElementById('settings-update-progress-text');
        const settingsProgressBar = document.getElementById('settings-update-progress-bar');

        if (settingsProgressContainer && settingsProgressText && settingsProgressBar) {
            settingsProgressContainer.classList.remove('hidden');
            settingsProgressText.textContent = `${progress}%`;
            settingsProgressBar.style.width = `${progress}%`;
        }
    }

    /**
     * Displays a native update dialog overlay.
     */
    showUpdateModal(version, downloadUrl) {
        const updateModal = document.getElementById('update-modal');
        const updateMsg = document.getElementById('update-modal-message');
        const downloadBtn = document.getElementById('update-download-btn');
        const closeBtn = document.getElementById('update-close-btn');

        if (!updateModal) return;

        updateMsg.textContent = `يتوفر إصدار جديد من التطبيق (${version}). هل تريد تحميل التحديث الآن؟`;

        downloadBtn.textContent = 'تحميل';
        downloadBtn.disabled = false;
        closeBtn.classList.remove('hidden');

        const progressContainer = document.getElementById('update-progress-container');
        const progressBar = document.getElementById('update-progress-bar');
        const progressText = document.getElementById('update-progress-text');
        if (progressContainer && progressBar && progressText) {
            progressContainer.classList.add('hidden');
            progressBar.style.width = '0%';
            progressText.textContent = '0%';
        }

        downloadBtn.onclick = async () => {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AppUpdater) {
                downloadBtn.textContent = 'جاري التحميل...';
                downloadBtn.disabled = true;
                closeBtn.classList.add('hidden');

                if (progressContainer) progressContainer.classList.remove('hidden');
                updateMsg.textContent = 'جاري تحميل ملف التحديث الجديد. ستظهر لك شاشة التثبيت فور اكتماله.';

                try {
                    await window.Capacitor.Plugins.AppUpdater.downloadAndInstallApk({ url: downloadUrl });
                    updateModal.classList.add('hidden');
                    if (progressContainer) progressContainer.classList.add('hidden');
                } catch (e) {
                    console.error("Native update failed:", e);
                    window.open(downloadUrl, '_blank');
                    updateModal.classList.add('hidden');
                    if (progressContainer) progressContainer.classList.add('hidden');
                }
            } else {
                window.open(downloadUrl, '_blank');
                updateModal.classList.add('hidden');
            }
        };

        closeBtn.onclick = () => {
            localStorage.setItem('dismissed_update_version', version);
            updateModal.classList.add('hidden');
        };

        updateModal.classList.remove('hidden');
    }

    /**
     * Checks the GitHub API for latest releases and starts update UI check.
     */
    async checkUpdates(isManual = false) {
        const updateStatusLi = document.getElementById('update-status-li');
        const updateStatusText = document.getElementById('update-status-text');
        const downloadUpdateBtn = document.getElementById('download-update-btn');
        const checkUpdateBtn = document.getElementById('check-update-btn');

        if (isManual) {
            if (checkUpdateBtn) {
                checkUpdateBtn.textContent = 'جاري التحقق...';
                checkUpdateBtn.disabled = true;
            }
            if (updateStatusLi) updateStatusLi.classList.add('hidden');
        }

        try {
            const response = await fetch('https://api.github.com/repos/ibrahim317/ums-frontend/releases/latest');
            if (!response.ok) throw new Error('GitHub API error');

            const release = await response.json();
            const latestVersion = release.tag_name || '';
            const latestVersionClean = latestVersion.replace(/^v/i, '');

            const isNewer = this.isNewerVersion(latestVersionClean, appState.CURRENT_APP_VERSION);

            if (isNewer) {
                const targetAssetName = `SGP-v${latestVersionClean}.apk`;
                const apkAsset = release.assets.find(asset => asset.name === targetAssetName);

                if (apkAsset) {
                    const downloadUrl = apkAsset.browser_download_url;

                    if (updateStatusLi && updateStatusText && downloadUpdateBtn) {
                        updateStatusLi.classList.remove('hidden');
                        updateStatusText.textContent = `يتوفر تحديث جديد: ${latestVersion}`;
                        downloadUpdateBtn.classList.remove('hidden');

                        downloadUpdateBtn.textContent = 'تحميل التحديث الآن';
                        downloadUpdateBtn.disabled = false;

                        const progressContainer = document.getElementById('settings-update-progress-container');
                        const progressBar = document.getElementById('settings-update-progress-bar');
                        const progressText = document.getElementById('settings-update-progress-text');
                        if (progressContainer && progressBar && progressText) {
                            progressContainer.classList.add('hidden');
                            progressBar.style.width = '0%';
                            progressText.textContent = '0%';
                        }

                        downloadUpdateBtn.onclick = async () => {
                            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AppUpdater) {
                                downloadUpdateBtn.textContent = 'جاري تحميل التحديث...';
                                downloadUpdateBtn.disabled = true;
                                if (progressContainer) progressContainer.classList.remove('hidden');
                                updateStatusText.textContent = 'جاري تحميل ملف التحديث في الخلفية. ستظهر لك شاشة التثبيت فور الاكتمال.';
                                try {
                                    await window.Capacitor.Plugins.AppUpdater.downloadAndInstallApk({ url: downloadUrl });
                                    downloadUpdateBtn.textContent = 'تحميل التحديث الآن';
                                    downloadUpdateBtn.disabled = false;
                                    updateStatusText.textContent = `تم تحميل وتثبيت التحديث ${latestVersion}.`;
                                    if (progressContainer) progressContainer.classList.add('hidden');
                                } catch (e) {
                                    console.error("Native update failed:", e);
                                    window.open(downloadUrl, '_blank');
                                    downloadUpdateBtn.textContent = 'تحميل التحديث الآن';
                                    downloadUpdateBtn.disabled = false;
                                    updateStatusText.textContent = 'فشل التحميل التلقائي. تم فتح رابط التحميل في المتصفح.';
                                    if (progressContainer) progressContainer.classList.add('hidden');
                                }
                            } else {
                                window.open(downloadUrl, '_blank');
                            }
                        };
                    }

                    const dismissed = localStorage.getItem('dismissed_update_version');
                    if (!isManual && dismissed !== latestVersion) {
                        this.showUpdateModal(latestVersion, downloadUrl);
                    } else if (isManual) {
                        this.showUpdateModal(latestVersion, downloadUrl);
                    }
                } else {
                    if (isManual && updateStatusLi && updateStatusText) {
                        updateStatusLi.classList.remove('hidden');
                        updateStatusText.textContent = `يتوفر إصدار جديد ${latestVersion} ولكن لم يتم العثور على ملف APK بعد (${targetAssetName}).`;
                        if (downloadUpdateBtn) downloadUpdateBtn.classList.add('hidden');
                    }
                }
            } else {
                if (isManual && updateStatusLi && updateStatusText) {
                    updateStatusLi.classList.remove('hidden');
                    updateStatusText.textContent = 'تطبيقك محدث إلى آخر إصدار!';
                    if (downloadUpdateBtn) downloadUpdateBtn.classList.add('hidden');
                }
            }
        } catch (err) {
            console.error('Failed to check for updates:', err);
            if (isManual && updateStatusLi && updateStatusText) {
                updateStatusLi.classList.remove('hidden');
                updateStatusText.textContent = 'فشل التحقق من وجود تحديثات. يرجى التحقق من اتصالك بالإنترنت.';
                if (downloadUpdateBtn) downloadUpdateBtn.classList.add('hidden');
            }
        } finally {
            if (checkUpdateBtn) {
                checkUpdateBtn.textContent = 'التحقق من التحديثات';
                checkUpdateBtn.disabled = false;
            }
        }
    }
}
