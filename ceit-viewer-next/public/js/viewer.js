const BACKEND_BASE_URL = 'http://localhost:3001';
const API_URL = `${BACKEND_BASE_URL}/posts/public`;
const EVENTS_API_URL = `${BACKEND_BASE_URL}/events/public`;
let currentFilter = '';
let currentMonth = new Date();
let loadedPostIds = new Set();
let monthEvents = [];

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatEventDate(dateValue) {
    const date = new Date(dateValue);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function renderUpcomingEvents() {
    const container = document.getElementById('upcomingEventsList');
    if (!container) return;

    const now = new Date();
    const upcoming = monthEvents
        .filter((ev) => new Date(ev.eventDate) >= now)
        .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate))
        .slice(0, 5);

    if (upcoming.length === 0) {
        container.innerHTML = '<div class="upcoming-empty">No upcoming events this month</div>';
        return;
    }

    container.innerHTML = upcoming.map((event) => {
        const title = escapeHtml(event.title || 'Untitled event');
        const location = escapeHtml(event.location || 'TBA');
        const dept = escapeHtml(event.departmentName || 'All Departments');
        return `
            <div class="upcoming-item">
                <div class="upcoming-item-title">${title}</div>
                <div class="upcoming-item-meta">📅 ${formatEventDate(event.eventDate)}</div>
                <div class="upcoming-item-meta">📍 ${location}</div>
                <div class="upcoming-item-meta">🏫 ${dept}</div>
            </div>
        `;
    }).join('');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        if (diffHours === 0) {
            const diffMinutes = Math.floor(diffTime / (1000 * 60));
            return diffMinutes === 0 ? 'Just now' : `${diffMinutes}m ago`;
        }
        return `${diffHours}h ago`;
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.postId = post.id;

    let isPDF = false;
    let pdfUrl = '';
    let thumbnailUrl = '';
    let displayContent = '';

    if (post.imageUrl) {
        if (post.imageUrl.includes('|')) {
            const parts = post.imageUrl.split('|');
            pdfUrl = parts[0];
            thumbnailUrl = parts[1];
            isPDF = true;
        } else if (post.imageUrl.toLowerCase().endsWith('.pdf')) {
            isPDF = true;
            pdfUrl = post.imageUrl;
        }
    }

    if (isPDF && pdfUrl) {
        if (pdfUrl !== 'PDF_PLACEHOLDER') {
            pdfCache.set(post.id, pdfUrl);
        }

        let fileName = 'document.pdf';
        if (pdfUrl.startsWith('data:')) {
            fileName = 'document.pdf';
        } else {
            fileName = pdfUrl.split('/').pop() || 'document.pdf';
        }

        const isPlaceholder = pdfUrl === 'PDF_PLACEHOLDER';

        displayContent = `
            ${thumbnailUrl ? `<img src="${thumbnailUrl.length < 1000 ? thumbnailUrl : ''}" data-src="${thumbnailUrl.length >= 1000 ? thumbnailUrl : ''}" alt="PDF Thumbnail" class="pdf-thumbnail" onclick="openImageViewerByElement(this)" loading="lazy" style="min-height: 200px; background: rgba(255,255,255,0.06);" />` : ''}
            <div class="pdf-badge" onclick="openPdfViewerForPost('${post.id}', '${fileName.replace(/'/g, "\\'")}'${isPlaceholder ? ', true' : ''})">
                <span>📄</span>
                <span>PDF Document</span>
            </div>
        `;
    } else if (post.imageUrl) {
        const isLargeBase64 = post.imageUrl.length > 1000;
        displayContent = `<img src="${isLargeBase64 ? '' : post.imageUrl}" data-src="${isLargeBase64 ? post.imageUrl : ''}" alt="Post image" class="post-image" loading="lazy" style="min-height: 200px; background: rgba(255,255,255,0.06); cursor: zoom-in;" onclick="openImageViewerByElement(this)" onerror="this.style.display='none'">`;
    }

    const urgentBadge = Math.random() > 0.7
        ? '<span class="urgent-badge">URGENT</span>'
        : '';

    card.innerHTML = `
        <div class="post-header">
            <div class="post-avatar">${getInitials(post.adminName)}</div>
            <div class="post-info">
                <div class="post-author">
                    <span class="author-name">${post.adminName || 'Unknown Admin'}</span>
                    ${urgentBadge}
                </div>
                <div class="post-meta">${post.departmentName || 'Unknown Department'}</div>
            </div>
        </div>
        <div class="post-body">${post.caption}</div>
        ${displayContent}
        <div class="post-footer">
            <div class="like-btn">
                <span>👍</span>
                <span>${Math.floor(Math.random() * 10)}</span>
            </div>
            <span>${formatDate(post.createdAt)}</span>
        </div>
    `;

    return card;
}

function toggleFilter() {
    const dropdown = document.getElementById('filterDropdown');
    dropdown.classList.toggle('show');
}

function filterByDepartment(departmentId) {
    currentFilter = departmentId;
    toggleFilter();
    loadPosts(true);
    loadEventsForMonth();
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = message ? 'block' : 'none';
}

async function loadPosts(isInitialLoad = true) {
    const container = document.getElementById('postsContainer');

    if (isInitialLoad) {
        showLoading(true);
        showError('');
        container.innerHTML = '';
        loadedPostIds.clear();
    }

    try {
        const url = currentFilter
            ? `${API_URL}?departmentId=${currentFilter}&limit=20`
            : `${API_URL}?limit=20`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const posts = await response.json();

        showLoading(false);

        if (posts.length === 0 && isInitialLoad) {
            container.innerHTML = `
                <div class="no-posts">
                    <h2>📭 No announcements yet</h2>
                    <p>Check back later for updates!</p>
                </div>
            `;
            return;
        }

        const departments = new Map();
        posts.forEach(post => {
            if (post.departmentName && post.departmentId) {
                departments.set(post.departmentId, post.departmentName);
            }
        });

        const filterDropdown = document.getElementById('filterDropdown');
        const existingOptions = filterDropdown.querySelectorAll('.filter-option').length;
        if (existingOptions === 1) {
            departments.forEach((name, id) => {
                const option = document.createElement('div');
                option.className = 'filter-option';
                option.textContent = name;
                option.onclick = () => filterByDepartment(id);
                filterDropdown.appendChild(option);
            });
        }

        if (isInitialLoad) {
            posts.forEach(post => {
                loadedPostIds.add(post.id);
                container.appendChild(createPostCard(post));
            });

            setupLazyLoading();
        } else {
            let newPostsCount = 0;
            posts.forEach(post => {
                if (!loadedPostIds.has(post.id)) {
                    loadedPostIds.add(post.id);
                    container.insertBefore(createPostCard(post), container.firstChild);
                    newPostsCount++;
                }
            });

            if (newPostsCount > 0) {
                console.log(`${newPostsCount} new post(s) added`);
            }
        }

    } catch (error) {
        if (isInitialLoad) {
            showLoading(false);
            showError(`Failed to load announcements: ${error.message}`);
        }
        console.error('Error loading posts:', error);
    }
}

async function checkForNewPosts() {
    await loadPosts(false);
}

async function loadEventsForMonth() {
    try {
        const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

        const params = new URLSearchParams({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        });
        if (currentFilter) params.set('departmentId', currentFilter);

        const response = await fetch(`${EVENTS_API_URL}?${params.toString()}`);
        if (!response.ok) throw new Error(`Events error: ${response.status}`);

        monthEvents = await response.json();
    } catch (e) {
        console.error('Failed to load events', e);
        monthEvents = [];
    } finally {
        generateCalendar();
        renderUpcomingEvents();
    }
}

function generateCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('calendarMonth').textContent = monthName;

    grid.innerHTML = '';

    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        grid.appendChild(header);
    });

    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    for (let i = 0; i < startDay; i++) {
        grid.appendChild(document.createElement('div'));
    }

    const today = new Date();

    const eventsByDate = new Map();
    monthEvents.forEach(ev => {
        const key = new Date(ev.eventDate).toDateString();
        const groupedEvents = eventsByDate.get(key) || [];
        groupedEvents.push(ev);
        eventsByDate.set(key, groupedEvents);
    });

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';

        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);

        if (date.toDateString() === today.toDateString()) {
            dayCell.classList.add('today');
        }

        const eventsForDay = eventsByDate.get(date.toDateString()) || [];
        const count = eventsForDay.length;
        if (count > 0) {
            dayCell.classList.add('has-event');
            const hoverItems = eventsForDay
                .slice(0, 3)
                .map((event) => `<div class="day-hover-item">• ${escapeHtml(event.title || 'Untitled event')}</div>`)
                .join('');

            dayCell.innerHTML = `
                <span>${day}</span>
                <div class="event-count">${count} EVENT${count > 1 ? 'S' : ''}</div>
                <div class="day-hover-card">
                    <div class="day-hover-title">${count} Event${count > 1 ? 's' : ''}</div>
                    ${hoverItems}
                </div>
            `;
            dayCell.title = eventsForDay.map((ev) => ev.title || 'Untitled event').join(' | ');
        } else {
            dayCell.textContent = day;
        }

        grid.appendChild(dayCell);
    }
}

function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    loadEventsForMonth();
}

function goToToday() {
    currentMonth = new Date();
    loadEventsForMonth();
}

function refreshViewer() {
    loadPosts(true);
    loadEventsForMonth();
}

window.onclick = function(event) {
    if (!event.target.matches('.filter-btn') && !event.target.matches('.filter-btn *')) {
        const dropdown = document.getElementById('filterDropdown');
        if (dropdown.classList.contains('show')) {
            dropdown.classList.remove('show');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    loadPosts(true);
    loadEventsForMonth();
});

function setupLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    if (images.length === 0) return;

    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.getAttribute('data-src');
                if (src) {
                    img.src = src;
                    img.removeAttribute('data-src');
                }
                imageObserver.unobserve(img);
            }
        });
    }, {
        rootMargin: '100px'
    });
    images.forEach(img => imageObserver.observe(img));
}

setInterval(checkForNewPosts, 60000);

const pdfCache = new Map();

function openImageViewerByElement(el) {
    const src = el.getAttribute('data-src') || el.getAttribute('src');
    if (!src) return;
    openImageViewer(src);
}

function openImageViewer(src) {
    const modal = document.getElementById('imageModal');
    const img = document.getElementById('imageModalImg');
    img.src = src;
    modal.classList.add('show');
}

function closeImageViewer() {
    const modal = document.getElementById('imageModal');
    const img = document.getElementById('imageModalImg');
    modal.classList.remove('show');
    img.src = '';
}

async function openPdfViewerForPost(postId, fileName, needsFetch = false) {
    try {
        let pdfUrl = null;

        if (pdfCache.has(postId)) {
            pdfUrl = pdfCache.get(postId);
        } else if (needsFetch) {
            const modal = document.getElementById('pdfModal');
            const container = document.getElementById('pdfViewerContainer');
            modal.style.display = 'block';
            container.innerHTML = '<div style="text-align: center; padding: 50px; color: #667eea;"><h3>Loading PDF...</h3></div>';

            const response = await fetch(`${API_URL}/${postId}`);
            if (!response.ok) throw new Error('Failed to load PDF');

            const post = await response.json();

            if (post.imageUrl && post.imageUrl.includes('|')) {
                const [pdf] = post.imageUrl.split('|');
                pdfUrl = pdf;
            } else {
                pdfUrl = post.imageUrl;
            }

            pdfCache.set(postId, pdfUrl);
        } else {
            const response = await fetch(`${API_URL}/${postId}`);
            if (!response.ok) throw new Error('Failed to load PDF');
            const post = await response.json();

            if (post.imageUrl && post.imageUrl.includes('|')) {
                const [pdf] = post.imageUrl.split('|');
                pdfUrl = pdf;
            } else {
                pdfUrl = post.imageUrl;
            }

            if (pdfUrl) {
                pdfCache.set(postId, pdfUrl);
            }
        }

        if (pdfUrl) {
            const redirected = openPdfPreviewPage(pdfUrl);
            if (!redirected) {
                openPdfViewer(pdfUrl, fileName);
            }
        }
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Failed to load PDF. Please try again.');
    }
}

function extractDocumentId(pdfUrl) {
    try {
        const u = new URL(pdfUrl, window.location.origin);
        const parts = u.pathname.split('/').filter(Boolean);
        const docIdx = parts.indexOf('documents');
        if (docIdx >= 0 && parts[docIdx + 1]) {
            return parts[docIdx + 1];
        }
        return '';
    } catch {
        return '';
    }
}

function openPdfPreviewPage(pdfUrl) {
    const docId = extractDocumentId(pdfUrl);
    if (!docId) return false;
    const target = `${BACKEND_BASE_URL}/pdf_preview.html?id=${encodeURIComponent(docId)}`;
    window.open(target, '_blank');
    return true;
}

function openPdfViewer(pdfUrl, fileName) {
    const redirected = openPdfPreviewPage(pdfUrl);
    if (redirected) return;

    const modal = document.getElementById('pdfModal');
    const container = document.getElementById('pdfViewerContainer');
    const titleEl = document.getElementById('pdfTitle');
    const downloadBtn = document.getElementById('pdfDownloadBtn');

    titleEl.textContent = fileName;

    container.innerHTML = '';

    if (pdfUrl.startsWith('data:application/pdf')) {
        const objectEl = document.createElement('object');
        objectEl.data = pdfUrl;
        objectEl.type = 'application/pdf';
        objectEl.className = 'pdf-viewer-object';

        objectEl.innerHTML = `
            <div class="pdf-error-message">
                <p>Your browser cannot display PDFs inline.</p>
                <p><a href="${pdfUrl}" download="${fileName}">Click here to download the PDF</a></p>
            </div>
        `;

        container.appendChild(objectEl);
    } else if (pdfUrl.startsWith('http')) {
        const iframe = document.createElement('iframe');
        iframe.className = 'pdf-viewer-iframe';
        iframe.src = pdfUrl;
        container.appendChild(iframe);
    } else {
        container.innerHTML = `
            <div class="pdf-error-message">
                <p>⚠️ Invalid PDF file.</p>
                <p>Please re-upload this document.</p>
            </div>
        `;
    }

    downloadBtn.onclick = () => downloadPdf(pdfUrl, fileName);

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closePdfViewer() {
    const modal = document.getElementById('pdfModal');
    const container = document.getElementById('pdfViewerContainer');

    modal.classList.remove('show');
    container.innerHTML = '';
    document.body.style.overflow = 'auto';
}

function downloadPdf(pdfUrl, fileName) {
    const link = document.createElement('a');

    if (pdfUrl.startsWith('data:')) {
        link.href = pdfUrl;
        link.download = fileName;
    } else {
        link.href = pdfUrl;
        link.download = fileName;
        link.target = '_blank';
    }

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePdfViewer();
    }
});
