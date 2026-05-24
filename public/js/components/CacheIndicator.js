export const renderCacheIndicator = (containerId, updatedAt, onRevalidate) => {
    const container = document.getElementById(containerId);
    
    // Format the date
    let timeStr = 'غير معروف';
    if (updatedAt) {
        const date = new Date(updatedAt + 'Z');
        timeStr = date.toLocaleString('ar-EG', { 
            hour: 'numeric', minute: 'numeric', hour12: true, 
            year: 'numeric', month: 'numeric', day: 'numeric' 
        });
    }

    container.innerHTML = `
        <div class="cache-indicator">
            <div class="cache-time">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                بيانات التخزين المؤقت:
                <span>${timeStr}</span>
            </div>
            <button class="revalidate-btn">
                تحديث الأن
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
            </button>
        </div>
    `;

    const btn = container.querySelector('.revalidate-btn');
    btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.innerHTML = 'جاري التحديث...';
        onRevalidate();
    });
};

export const removeCacheIndicator = (containerId) => {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
};
