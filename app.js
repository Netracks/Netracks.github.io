import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 🔁 REPLACE WITH YOUR FIREBASE CONFIGURATION
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const linksRef = ref(db, 'links');

// DOM elements
const totalClicksSpan = document.getElementById('totalClicks');
const totalLinksSpan = document.getElementById('totalLinks');
const linksContainer = document.getElementById('linksContainer');
const addLinkBtn = document.getElementById('addLinkBtn');
const linkNameInput = document.getElementById('linkName');
const linkUrlInput = document.getElementById('linkUrl');
const clearAllBtn = document.getElementById('clearAllBtn');

// Helper: get base URL for redirect links (current origin)
function getRedirectBase() {
    return window.location.origin;
}

// Render all links in real time
function renderLinks(linksData) {
    if (!linksData) {
        linksContainer.innerHTML = `<div class="empty-state">✨ No links yet. Create your first tracking link above.</div>`;
        return;
    }

    const linkIds = Object.keys(linksData);
    if (linkIds.length === 0) {
        linksContainer.innerHTML = `<div class="empty-state">✨ No links yet. Create your first tracking link above.</div>`;
        return;
    }

    // Calculate totals
    let totalClicks = 0;
    linkIds.forEach(id => {
        totalClicks += linksData[id].clickCount || 0;
    });
    totalClicksSpan.innerText = totalClicks;
    totalLinksSpan.innerText = linkIds.length;

    // Build HTML
    let html = '';
    for (let id of linkIds) {
        const link = linksData[id];
        const name = link.name || 'Unnamed';
        const destination = link.destinationUrl || '#';
        const clickCount = link.clickCount || 0;
        const trackingUrl = `${getRedirectBase()}/redirect.html?id=${id}`;

        html += `
            <div class="link-card" data-id="${id}">
                <div class="link-info">
                    <div class="link-name">
                        ${escapeHtml(name)}
                        <span class="link-badge">🔗 tracked</span>
                    </div>
                    <div class="link-dest">➡️ ${escapeHtml(destination)}</div>
                    <div class="tracking-link" title="Click to copy tracking link">📎 ${escapeHtml(trackingUrl)}</div>
                </div>
                <div class="link-stats">
                    <div class="click-count">🖱️ ${clickCount} click${clickCount !== 1 ? 's' : ''}</div>
                    <button class="copy-btn" data-url="${trackingUrl}" title="Copy tracking link">📋</button>
                    <button class="delete-btn" data-id="${id}" title="Delete link">🗑️</button>
                </div>
            </div>
        `;
    }
    linksContainer.innerHTML = html;

    // Attach copy & delete events
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = btn.getAttribute('data-url');
            navigator.clipboard.writeText(url);
            const original = btn.innerText;
            btn.innerText = '✓';
            setTimeout(() => btn.innerText = original, 1000);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            if (confirm('Delete this link? Clicks will be lost.')) {
                await remove(ref(db, `links/${id}`));
            }
        });
    });
}

// Simple XSS protection
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
        return c;
    });
}

// Add new link
async function addNewLink() {
    const name = linkNameInput.value.trim();
    let destination = linkUrlInput.value.trim();
    if (!name) {
        alert('Please enter a link name');
        return;
    }
    if (!destination) {
        alert('Please enter a destination URL (https://...)');
        return;
    }
    if (!destination.startsWith('http://') && !destination.startsWith('https://')) {
        destination = 'https://' + destination;
    }
    try {
        new URL(destination); // validate
    } catch(e) {
        alert('Invalid URL. Use format like https://example.com');
        return;
    }

    const newLinkRef = push(linksRef);
    await set(newLinkRef, {
        name: name,
        destinationUrl: destination,
        clickCount: 0,
        createdAt: Date.now()
    });
    linkNameInput.value = '';
    linkUrlInput.value = '';
}

// Clear all links (danger)
async function clearAllLinks() {
    if (confirm('⚠️ Delete ALL links and their click counts? This action is permanent.')) {
        await set(linksRef, null);
    }
}

// Real-time listener
onValue(linksRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
        totalClicksSpan.innerText = '0';
        totalLinksSpan.innerText = '0';
        linksContainer.innerHTML = `<div class="empty-state">✨ No links yet. Create your first tracking link above.</div>`;
        return;
    }
    renderLinks(data);
}, (error) => {
    console.error("Firebase read failed:", error);
    linksContainer.innerHTML = `<div class="empty-state">⚠️ Database error. Check config & rules.</div>`;
});

// Event listeners
addLinkBtn.addEventListener('click', addNewLink);
clearAllBtn.addEventListener('click', clearAllLinks);

// Also allow pressing Enter in inputs
linkUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addNewLink();
});
linkNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addNewLink();
});