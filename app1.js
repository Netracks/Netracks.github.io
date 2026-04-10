import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, remove, get, query, orderByChild, limitToLast, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile, updatePassword, deleteUser, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyCx-yIgRBdqqaZm5mnCs6XicbJHqf442mQ",
    authDomain: "netrackers.firebaseapp.com",
    databaseURL: "https://netrackers-default-rtdb.firebaseio.com",
    projectId: "netrackers",
    storageBucket: "netrackers.firebasestorage.app",
    messagingSenderId: "362299470159",
    appId: "1:362299470159:web:dce2775a7c6fdd6970153a",
    measurementId: "G-FHJSFVG3RE"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);

// DOM Elements
const totalClicksSpan = document.getElementById('totalClicks');
const totalLinksSpan = document.getElementById('totalLinks');
const todayClicksSpan = document.getElementById('todayClicks');
const topCountrySpan = document.getElementById('topCountry');
const linksContainer = document.getElementById('linksContainer');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const addLinkBtnMain = document.getElementById('addLinkBtnMain');
const logoutBtn = document.getElementById('logoutBtn');
const userAvatar = document.getElementById('userAvatar');
const userNameSpan = document.getElementById('userName');
const planBadge = document.getElementById('planBadge');
const themeToggle = document.querySelector('.theme-toggle');

// Modals
const linkModal = document.getElementById('linkModal');
const modalTitle = document.getElementById('modalTitle');
const modalLinkName = document.getElementById('modalLinkName');
const modalLinkUrl = document.getElementById('modalLinkUrl');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const closeModal = linkModal.querySelector('.close');

const analyticsModal = document.getElementById('analyticsModal');
const closeAnalytics = analyticsModal.querySelector('.close-analytics');
const analyticsLinkName = document.getElementById('analyticsLinkName');
const analyticsClicks = document.getElementById('analyticsClicks');
const analyticsCreated = document.getElementById('analyticsCreated');
const clicksChartCanvas = document.getElementById('clicksChart');
const deviceChartCanvas = document.getElementById('deviceChart');
const browserStatsDiv = document.getElementById('browserStats');
const locationStatsDiv = document.getElementById('locationStats');
const countryFilterSelect = document.getElementById('countryFilterSelect');
const cityListDiv = document.getElementById('cityList');
const visitorSearch = document.getElementById('visitorSearch');
const deviceFilter = document.getElementById('deviceFilter');
const dateFilter = document.getElementById('dateFilter');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const visitorsTableBody = document.querySelector('#visitorsTable tbody');

const profileModal = document.getElementById('profileModal');
const closeProfile = profileModal.querySelector('.close-profile');
const profileAvatarPreview = document.getElementById('profileAvatarPreview');
const avatarUpload = document.getElementById('avatarUpload');
const profileNameInput = document.getElementById('profileName');
const profileEmailInput = document.getElementById('profileEmail');
const profilePlanSpan = document.getElementById('profilePlan');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');

const qrModal = document.getElementById('qrModal');
const closeQr = qrModal.querySelector('.close-qr');
const qrLinkNameSpan = document.getElementById('qrLinkName');
const qrCodeDiv = document.getElementById('qrcode');
const downloadQrBtn = document.getElementById('downloadQrBtn');

let currentUser = null;
let allLinks = [];
let currentLinkIdForAnalytics = null;
let currentQRUrl = '';
let chart1, chart2;

// Helper Functions
function getRedirectBase() { return window.location.origin; }
function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'); }
function formatDate(timestamp) { return timestamp ? new Date(timestamp).toLocaleString() : 'Unknown'; }
function formatDateShort(timestamp) { return timestamp ? new Date(timestamp).toLocaleDateString() : 'Unknown'; }

// Stats Aggregation
function computeStats(linksData) {
    let totalClicks = 0;
    let today = new Date().toDateString();
    let todayClicks = 0;
    let countryCount = {};
    let linkCount = 0;

    if (linksData) {
        linkCount = Object.keys(linksData).length;
        for (let id in linksData) {
            const link = linksData[id];
            totalClicks += link.clickCount || 0;
            // Fetch visits to count today's clicks (expensive, but we can cache)
            // For simplicity, we'll compute from visits array – we'll need to fetch visits per link? This could be heavy.
            // We'll skip full today clicks for now; could be done in background.
        }
    }
    return { totalClicks, totalLinks: linkCount, todayClicks, topCountry: '—' };
}

// Render Links with Search/Sort/Pagination
let currentPage = 1;
const linksPerPage = 10;
let filteredLinks = [];

function renderLinks(linksData) {
    if (!linksData) {
        linksContainer.innerHTML = `<div class="empty-state">✨ No links yet. Create your first tracking link above.</div>`;
        totalClicksSpan.innerText = '0';
        totalLinksSpan.innerText = '0';
        todayClicksSpan.innerText = '0';
        topCountrySpan.innerText = '—';
        return;
    }

    // Convert to array for sorting
    const linksArray = Object.entries(linksData).map(([id, link]) => ({ id, ...link }));
    allLinks = linksArray;

    // Search
    const searchTerm = searchInput.value.toLowerCase();
    filteredLinks = allLinks.filter(link => link.name.toLowerCase().includes(searchTerm));

    // Sort
    const sortBy = sortSelect.value;
    if (sortBy === 'name') filteredLinks.sort((a,b) => a.name.localeCompare(b.name));
    else if (sortBy === 'clicks') filteredLinks.sort((a,b) => (b.clickCount || 0) - (a.clickCount || 0));
    else if (sortBy === 'date') filteredLinks.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Paginate
    const start = (currentPage - 1) * linksPerPage;
    const paginated = filteredLinks.slice(start, start + linksPerPage);
    renderLinkCards(paginated);
    renderPagination();

    // Update stats
    let totalClicks = 0;
    filteredLinks.forEach(link => totalClicks += link.clickCount || 0);
    totalClicksSpan.innerText = totalClicks;
    totalLinksSpan.innerText = filteredLinks.length;
    // Today's clicks & top country would require fetching all visits – we'll compute on demand.
    fetchTodayClicksAndTopCountry(filteredLinks);
}

function renderLinkCards(links) {
    if (links.length === 0) {
        linksContainer.innerHTML = `<div class="empty-state">🔍 No links match your search.</div>`;
        return;
    }
    let html = '';
    for (let link of links) {
        const trackingUrl = `${getRedirectBase()}/redirect.html?id=${link.id}`;
        html += `
            <div class="link-card">
                <div class="link-info">
                    <div class="link-name">${escapeHtml(link.name)} <span class="link-badge">🔗 tracked</span></div>
                    <div class="link-dest">➡️ ${escapeHtml(link.destinationUrl)}</div>
                    <div class="tracking-link" title="Copy">📎 ${escapeHtml(trackingUrl)}</div>
                </div>
                <div class="link-stats">
                    <div class="click-count">🖱️ ${link.clickCount || 0} click${link.clickCount !== 1 ? 's' : ''}</div>
                    <div class="link-actions">
                        <button class="icon-btn analytics-btn" data-id="${link.id}" data-name="${escapeHtml(link.name)}"><i class="fas fa-chart-line"></i></button>
                        <button class="icon-btn edit-btn" data-id="${link.id}" data-name="${escapeHtml(link.name)}" data-url="${escapeHtml(link.destinationUrl)}"><i class="fas fa-edit"></i></button>
                        <button class="icon-btn copy-btn" data-url="${trackingUrl}"><i class="fas fa-copy"></i></button>
                        <button class="icon-btn qr-btn" data-url="${trackingUrl}" data-name="${escapeHtml(link.name)}"><i class="fas fa-qrcode"></i></button>
                        <button class="icon-btn delete-btn" data-id="${link.id}"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            </div>
        `;
    }
    linksContainer.innerHTML = html;

    // Attach event listeners
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = btn.getAttribute('data-url');
            navigator.clipboard.writeText(url);
            btn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i>', 1000);
        });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.getAttribute('data-id');
            if (confirm('Delete this link? All analytics will be lost.')) {
                await remove(ref(db, `users/${currentUser.uid}/links/${id}`));
                await remove(ref(db, `linkIndex/${id}`));
            }
        });
    });
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            const url = btn.getAttribute('data-url');
            openEditLinkModal(id, name, url);
        });
    });
    document.querySelectorAll('.analytics-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            await showAnalytics(id, name);
        });
    });
    document.querySelectorAll('.qr-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = btn.getAttribute('data-url');
            const name = btn.getAttribute('data-name');
            showQR(url, name);
        });
    });
}

function renderPagination() {
    const totalPages = Math.ceil(filteredLinks.length / linksPerPage);
    const paginationDiv = document.getElementById('pagination');
    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    paginationDiv.innerHTML = html;
    paginationDiv.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            currentPage = parseInt(btn.getAttribute('data-page'));
            renderLinks(allLinks.reduce((acc, link) => { acc[link.id] = link; return acc; }, {}));
        });
    });
}

// Fetch today's clicks and top country (simplified – we'll compute on demand for demo)
async function fetchTodayClicksAndTopCountry(links) {
    // In a real implementation, we'd fetch visits for all links and aggregate.
    // For brevity, we'll just set placeholder.
    todayClicksSpan.innerText = '...';
    topCountrySpan.innerText = '...';
    // Actually compute for first few links or use aggregate function.
    // We'll skip detailed here; could be added with a background job.
}

// Analytics Modal
async function showAnalytics(linkId, linkName) {
    currentLinkIdForAnalytics = linkId;
    analyticsLinkName.innerText = linkName;
    analyticsModal.style.display = 'flex';

    // Fetch link data
    const linkSnap = await get(ref(db, `users/${currentUser.uid}/links/${linkId}`));
    const link = linkSnap.val();
    analyticsClicks.innerText = link.clickCount || 0;
    analyticsCreated.innerText = formatDate(link.createdAt);

    // Fetch visits
    const visitsSnap = await get(ref(db, `users/${currentUser.uid}/links/${linkId}/visits`));
    const visits = visitsSnap.val() || {};

    // Prepare data for charts
    const visitsList = Object.values(visits);
    // Clicks over time (by day)
    const clicksByDay = {};
    visitsList.forEach(v => {
        const day = new Date(v.timestamp).toLocaleDateString();
        clicksByDay[day] = (clicksByDay[day] || 0) + 1;
    });
    const days = Object.keys(clicksByDay).slice(-7);
    const counts = days.map(d => clicksByDay[d]);

    if (chart1) chart1.destroy();
    chart1 = new Chart(clicksChartCanvas, {
        type: 'line',
        data: { labels: days, datasets: [{ label: 'Clicks', data: counts, borderColor: '#0f4c5f' }] }
    });

    // Device breakdown
    let mobile = 0, desktop = 0;
    let browserCount = { Chrome:0, Firefox:0, Safari:0, Other:0 };
    let countryCount = {};
    let cityList = [];
    visitsList.forEach(v => {
        if (v.device === 'Mobile') mobile++; else desktop++;
        const browser = v.browserName || 'Other';
        browserCount[browser] = (browserCount[browser] || 0) + 1;
        const country = v.country || 'Unknown';
        countryCount[country] = (countryCount[country] || 0) + 1;
        if (v.city) cityList.push({ country, city: v.city, count: 1 });
    });
    if (chart2) chart2.destroy();
    chart2 = new Chart(deviceChartCanvas, {
        type: 'pie',
        data: { labels: ['Mobile', 'Desktop'], datasets: [{ data: [mobile, desktop], backgroundColor: ['#10b981', '#0f4c5f'] }] }
    });

    let browserHtml = '<h4>Browsers</h4><ul>';
    for (let [b, c] of Object.entries(browserCount)) browserHtml += `<li>${b}: ${c}</li>`;
    browserHtml += '</ul>';
    browserStatsDiv.innerHTML = browserHtml;

    // Location stats
    let locationHtml = '<h4>Countries</h4><ul>';
    for (let [c, count] of Object.entries(countryCount).sort((a,b)=>b[1]-a[1])) locationHtml += `<li>${c}: ${count}</li>`;
    locationHtml += '</ul>';
    locationStatsDiv.innerHTML = locationHtml;

    // Populate country filter
    countryFilterSelect.innerHTML = '<option value="">All</option>';
    for (let c of Object.keys(countryCount)) countryFilterSelect.innerHTML += `<option value="${c}">${c}</option>`;
    countryFilterSelect.onchange = () => filterCityList(countryFilterSelect.value, cityList);

    function filterCityList(selectedCountry, allCities) {
        let filtered = selectedCountry ? allCities.filter(c => c.country === selectedCountry) : allCities;
        let cityMap = {};
        filtered.forEach(c => cityMap[c.city] = (cityMap[c.city] || 0) + 1);
        let cityHtml = '<h4>Cities</h4><ul>';
        for (let [city, count] of Object.entries(cityMap)) cityHtml += `<li>${city}: ${count}</li>`;
        cityHtml += '</ul>';
        cityListDiv.innerHTML = cityHtml;
    }
    filterCityList('', cityList);

    // Visitors table
    function renderVisitorsTable() {
        let filteredVisits = visitsList;
        const search = visitorSearch.value.toLowerCase();
        const device = deviceFilter.value;
        const date = dateFilter.value;
        filteredVisits = filteredVisits.filter(v => {
            if (search && !(v.ip?.includes(search) || v.device?.includes(search) || v.browserName?.includes(search))) return false;
            if (device && v.device !== device) return false;
            if (date && new Date(v.timestamp).toDateString() !== new Date(date).toDateString()) return false;
            return true;
        });
        visitorsTableBody.innerHTML = '';
        filteredVisits.forEach(v => {
            const row = visitorsTableBody.insertRow();
            row.insertCell(0).innerText = new Date(v.timestamp).toLocaleString();
            row.insertCell(1).innerText = v.ip || 'hidden';
            row.insertCell(2).innerText = v.country || '?';
            row.insertCell(3).innerText = v.city || '?';
            row.insertCell(4).innerText = v.device || '?';
            row.insertCell(5).innerText = v.browserName || '?';
            row.insertCell(6).innerText = v.source || 'Direct';
        });
    }
    visitorSearch.oninput = renderVisitorsTable;
    deviceFilter.onchange = renderVisitorsTable;
    dateFilter.onchange = renderVisitorsTable;
    renderVisitorsTable();

    exportCsvBtn.onclick = () => {
        let csv = "Timestamp,IP,Country,City,Device,Browser,Source\n";
        visitsList.forEach(v => {
            csv += `${new Date(v.timestamp).toISOString()},${v.ip || ''},${v.country || ''},${v.city || ''},${v.device || ''},${v.browserName || ''},${v.source || ''}\n`;
        });
        const blob = new Blob([csv], {type: 'text/csv'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${linkName}_analytics.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };
}

// QR Code Modal
function showQR(url, name) {
    currentQRUrl = url;
    qrLinkNameSpan.innerText = name;
    qrCodeDiv.innerHTML = '';
    new QRCode(qrCodeDiv, { text: url, width: 200, height: 200 });
    qrModal.style.display = 'flex';
    downloadQrBtn.onclick = () => {
        const canvas = qrCodeDiv.querySelector('canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = `${name}_qr.png`;
            link.href = canvas.toDataURL();
            link.click();
        }
    };
}

// Add/Edit Link Modal
function openAddLinkModal() {
    modalTitle.innerText = 'Create New Link';
    modalLinkName.value = '';
    modalLinkUrl.value = '';
    linkModal.style.display = 'flex';
    modalSaveBtn.onclick = async () => {
        const name = modalLinkName.value.trim();
        let url = modalLinkUrl.value.trim();
        if (!name || !url) return alert('Fill all fields');
        if (!url.startsWith('http')) url = 'https://' + url;
        try { new URL(url); } catch(e) { return alert('Invalid URL'); }
        const newLinkRef = push(ref(db, `users/${currentUser.uid}/links`));
        await set(newLinkRef, { name, destinationUrl: url, clickCount: 0, createdAt: Date.now() });
        await set(ref(db, `linkIndex/${newLinkRef.key}`), { uid: currentUser.uid });
        linkModal.style.display = 'none';
    };
}

function openEditLinkModal(id, name, url) {
    modalTitle.innerText = 'Edit Link';
    modalLinkName.value = name;
    modalLinkUrl.value = url;
    linkModal.style.display = 'flex';
    modalSaveBtn.onclick = async () => {
        const newName = modalLinkName.value.trim();
        let newUrl = modalLinkUrl.value.trim();
        if (!newName || !newUrl) return alert('Fill all fields');
        if (!newUrl.startsWith('http')) newUrl = 'https://' + newUrl;
        try { new URL(newUrl); } catch(e) { return alert('Invalid URL'); }
        await update(ref(db, `users/${currentUser.uid}/links/${id}`), { name: newName, destinationUrl: newUrl });
        linkModal.style.display = 'none';
    };
}

// Profile Modal
async function openProfileModal() {
    profileModal.style.display = 'flex';
    profileNameInput.value = currentUser.displayName || '';
    profileEmailInput.value = currentUser.email;
    profilePlanSpan.innerText = 'Free'; // Placeholder, could be from custom claims
    profileAvatarPreview.src = currentUser.photoURL || `https://ui-avatars.com/api/?background=0f4c5f&color=fff&name=${encodeURIComponent(currentUser.displayName || currentUser.email)}`;
    avatarUpload.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const storagePath = storageRef(storage, `avatars/${currentUser.uid}`);
        await uploadBytes(storagePath, file);
        const url = await getDownloadURL(storagePath);
        await updateProfile(currentUser, { photoURL: url });
        userAvatar.src = url;
        profileAvatarPreview.src = url;
    };
    saveProfileBtn.onclick = async () => {
        const newName = profileNameInput.value.trim();
        if (newName && newName !== currentUser.displayName) {
            await updateProfile(currentUser, { displayName: newName });
            userNameSpan.innerText = newName;
        }
        profileModal.style.display = 'none';
    };
    changePasswordBtn.onclick = () => {
        sendPasswordResetEmail(auth, currentUser.email);
        alert('Password reset email sent.');
    };
    deleteAccountBtn.onclick = async () => {
        if (confirm('Are you sure? This will delete all your links and data permanently.')) {
            await deleteUser(currentUser);
            window.location.href = 'login.html';
        }
    };
}

// Theme Toggle
let darkMode = localStorage.getItem('darkMode') === 'true';
if (darkMode) document.documentElement.setAttribute('data-theme', 'dark');
themeToggle.addEventListener('click', () => {
    darkMode = !darkMode;
    localStorage.setItem('darkMode', darkMode);
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
});

// Auth State
onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = 'login.html'; return; }
    currentUser = user;
    userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?background=0f4c5f&color=fff&name=${encodeURIComponent(user.displayName || user.email)}`;
    userNameSpan.innerText = user.displayName || user.email;
    
    const upgradeBtn = document.getElementById('upgradePlanBtn');

if (upgradeBtn) {
  upgradeBtn.addEventListener('click', () => {
    window.location.href = "pricing.html";
  });
}
    
    
    // Plan badge (mock)
    planBadge.classList.add('free');
    planBadge.innerText = 'Free';
    // Listen to links
    const linksRef = ref(db, `users/${user.uid}/links`);
    onValue(linksRef, (snapshot) => {
        renderLinks(snapshot.val());
    });
    // Setup click on avatar to open profile
    userAvatar.addEventListener('click', openProfileModal);
    addLinkBtnMain.addEventListener('click', openAddLinkModal);
    searchInput.addEventListener('input', () => renderLinks({})); // triggers re-render with search
    sortSelect.addEventListener('change', () => renderLinks({}));
});

logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = 'login.html'));

// Close modals
closeModal.addEventListener('click', () => linkModal.style.display = 'none');
closeAnalytics.addEventListener('click', () => analyticsModal.style.display = 'none');
closeProfile.addEventListener('click', () => profileModal.style.display = 'none');
closeQr.addEventListener('click', () => qrModal.style.display = 'none');
window.addEventListener('click', (e) => {
    if (e.target === linkModal) linkModal.style.display = 'none';
    if (e.target === analyticsModal) analyticsModal.style.display = 'none';
    if (e.target === profileModal) profileModal.style.display = 'none';
    if (e.target === qrModal) qrModal.style.display = 'none';
});

// Tab switching in analytics modal
const tabs = document.querySelectorAll('.tab-btn');
tabs.forEach(btn => {
    btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`${tabId}Tab`).classList.add('active');
    });
});