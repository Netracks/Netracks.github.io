import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

// DOM elements
const totalClicksSpan = document.getElementById('totalClicks');
const totalLinksSpan = document.getElementById('totalLinks');
const linksContainer = document.getElementById('linksContainer');
const addLinkBtn = document.getElementById('addLinkBtn');
const linkNameInput = document.getElementById('linkName');
const linkUrlInput = document.getElementById('linkUrl');
const clearAllBtn = document.getElementById('clearAllBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userDisplaySpan = document.getElementById('userDisplay');

let currentUser = null;

function getRedirectBase() {
    return window.location.origin;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function renderLinks(linksData) {
    if (!linksData || Object.keys(linksData).length === 0) {
        linksContainer.innerHTML = `<div class="empty-state">✨ No links yet. Create your first tracking link above.</div>`;
        totalClicksSpan.innerText = '0';
        totalLinksSpan.innerText = '0';
        return;
    }

    const linkIds = Object.keys(linksData);
    let totalClicks = 0;
    linkIds.forEach(id => totalClicks += linksData[id].clickCount || 0);
    totalClicksSpan.innerText = totalClicks;
    totalLinksSpan.innerText = linkIds.length;

    let html = '';
    for (let id of linkIds) {
        const link = linksData[id];
        const trackingUrl = `${getRedirectBase()}/redirect.html?id=${id}`;
        html += `
            <div class="link-card" data-id="${id}">
                <div class="link-info">
                    <div class="link-name">${escapeHtml(link.name)} <span class="link-badge">🔗 tracked</span></div>
                    <div class="link-dest">➡️ ${escapeHtml(link.destinationUrl)}</div>
                    <div class="tracking-link" title="Copy">📎 ${escapeHtml(trackingUrl)}</div>
                </div>
                <div class="link-stats">
                    <div class="click-count">🖱️ ${link.clickCount || 0} click${link.clickCount !== 1 ? 's' : ''}</div>
                    <button class="copy-btn" data-url="${trackingUrl}">📋</button>
                    <button class="delete-btn" data-id="${id}">🗑️</button>
                </div>
            </div>
        `;
    }
    linksContainer.innerHTML = html;

    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = btn.getAttribute('data-url');
            navigator.clipboard.writeText(url);
            btn.innerText = '✓';
            setTimeout(() => btn.innerText = '📋', 1000);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.getAttribute('data-id');
            if (confirm('Delete this link? Clicks will be lost.')) {
                // Remove from user's links
                await remove(ref(db, `users/${currentUser.uid}/links/${id}`));
                // Remove from global index
                await remove(ref(db, `linkIndex/${id}`));
            }
        });
    });
}

// ✅ FIXED: Add new link with correct path + global index
async function addNewLink() {
    if (!currentUser) {
        alert('You must be logged in');
        return;
    }

    const name = linkNameInput.value.trim();
    let destination = linkUrlInput.value.trim();

    if (!name || !destination) {
        alert('Please fill both fields');
        return;
    }

    if (!destination.startsWith('http://') && !destination.startsWith('https://')) {
        destination = 'https://' + destination;
    }

    try {
        new URL(destination);
    } catch(e) {
        alert('Invalid URL');
        return;
    }

    // Create new link under user's folder
    const newLinkRef = push(ref(db, `users/${currentUser.uid}/links`));
    await set(newLinkRef, {
        name: name,
        destinationUrl: destination,
        clickCount: 0,
        createdAt: Date.now()
    });

    // 🔥 Create global index entry for fast redirect lookup
    await set(ref(db, `linkIndex/${newLinkRef.key}`), {
        uid: currentUser.uid
    });

    linkNameInput.value = '';
    linkUrlInput.value = '';
}

// ✅ FIXED: Clear all links – also remove index entries
async function clearAllLinks() {
    if (!currentUser) return;
    if (!confirm('⚠️ Delete ALL your links and clicks? This cannot be undone.')) return;

    // Get all link IDs to delete from index
    const linksSnap = await get(ref(db, `users/${currentUser.uid}/links`));
    if (linksSnap.exists()) {
        const links = linksSnap.val();
        for (let linkId in links) {
            await remove(ref(db, `linkIndex/${linkId}`));
        }
    }
    // Delete all user links
    await set(ref(db, `users/${currentUser.uid}/links`), null);
}

function handleLogout() {
    signOut(auth).then(() => window.location.href = "login.html");
}

// Auth state listener
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    currentUser = user;
    if (logoutBtn) logoutBtn.style.display = 'inline-block';

    // Display user name from profile
    const profileRef = ref(db, `users/${user.uid}/profile`);
    onValue(profileRef, (snap) => {
        if (snap.exists() && userDisplaySpan) {
            const profile = snap.val();
            userDisplaySpan.textContent = `👋 ${profile.name || user.email}`;
        } else if (userDisplaySpan) {
            userDisplaySpan.textContent = `👋 ${user.email}`;
        }
    });

    // Listen to user's links in real time
    const linksRef = ref(db, `users/${user.uid}/links`);
    onValue(linksRef, (snapshot) => {
        renderLinks(snapshot.val());
    }, (error) => {
        console.error("Firebase read error:", error);
        linksContainer.innerHTML = `<div class="empty-state">⚠️ Database error. Check rules.</div>`;
    });

    addLinkBtn.disabled = false;
    clearAllBtn.disabled = false;
});

// Event listeners
addLinkBtn.addEventListener('click', addNewLink);
clearAllBtn.addEventListener('click', clearAllLinks);
if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

// Enter key shortcuts
linkUrlInput.addEventListener('keypress', (e) => e.key === 'Enter' && addNewLink());
linkNameInput.addEventListener('keypress', (e) => e.key === 'Enter' && addNewLink());