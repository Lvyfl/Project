const BACKEND_BASE_URL = 'http://localhost:3001';
const EVENTS_API_URL = `${BACKEND_BASE_URL}/events/public`;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showError(message) {
  const error = document.getElementById('error');
  error.textContent = message || '';
  error.style.display = message ? 'block' : 'none';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderEvents(events) {
  const grid = document.getElementById('eventsGrid');
  if (!events.length) {
    grid.innerHTML = '<div class="empty">No events found.</div>';
    return;
  }

  grid.innerHTML = events.map((event) => {
    const title = escapeHtml(event.title || 'Untitled Event');
    const dept = escapeHtml(event.departmentName || 'Unknown Department');
    const location = escapeHtml(event.location || 'TBA');
    const desc = escapeHtml(event.description || '');
    const image = event.eventImageUrl ? `<img class="event-img" src="${event.eventImageUrl}" alt="${title}" />` : '';
    const link = event.eventLink
      ? `<a class="event-link" href="${event.eventLink}" target="_blank" rel="noopener noreferrer">Open Event Link ↗</a>`
      : '';

    return `
      <div class="event-card">
        ${image}
        <div class="event-body">
          <div class="event-title">${title}</div>
          <div class="event-meta">🏫 ${dept}</div>
          <div class="event-meta">📍 ${location}</div>
          <div class="event-meta">🗓 ${formatDate(event.eventDate)}</div>
          ${desc ? `<div class="event-desc">${desc}</div>` : ''}
          ${link}
        </div>
      </div>
    `;
  }).join('');
}

function populateDepartments(events) {
  const select = document.getElementById('departmentFilter');
  const existing = new Set(Array.from(select.options).map((opt) => opt.value));
  events.forEach((event) => {
    if (event.departmentId && event.departmentName && !existing.has(event.departmentId)) {
      const option = document.createElement('option');
      option.value = event.departmentId;
      option.textContent = event.departmentName;
      select.appendChild(option);
      existing.add(event.departmentId);
    }
  });
}

async function loadEvents() {
  showLoading(true);
  showError('');
  const selectedDept = document.getElementById('departmentFilter').value;

  try {
    const params = new URLSearchParams();
    if (selectedDept) params.set('departmentId', selectedDept);
    const response = await fetch(`${EVENTS_API_URL}?${params.toString()}`);
    if (!response.ok) throw new Error(`Failed to load events (${response.status})`);

    const events = await response.json();
    events.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
    populateDepartments(events);
    renderEvents(events);
  } catch (error) {
    showError(error.message || 'Error loading events.');
  } finally {
    showLoading(false);
  }
}

document.addEventListener('DOMContentLoaded', loadEvents);
