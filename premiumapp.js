// At top after imports
let currentUserPlan = 'free'; // 'free', 'basic', 'pro'
let currentUserLimits = {
    maxLinks: 5, // free tier limit
    features: {
        locationTracking: false,
        deviceTracking: false,
        exportData: false
    }
};

// Add a function to fetch subscription and set limits
async function fetchUserPlan(uid) {
    const subRef = ref(db, `users/${uid}/subscription`);
    const snap = await get(subRef);
    if (snap.exists()) {
        const sub = snap.val();
        if (sub.active && sub.expiresAt > Date.now()) {
            if (sub.plan === 'basic') {
                currentUserPlan = 'basic';
                currentUserLimits = {
                    maxLinks: 20,
                    features: {
                        locationTracking: false,
                        deviceTracking: true,
                        exportData: false
                    }
                };
            } else if (sub.plan === 'pro') {
                currentUserPlan = 'pro';
                currentUserLimits = {
                    maxLinks: Infinity,
                    features: {
                        locationTracking: true,
                        deviceTracking: true,
                        exportData: true
                    }
                };
            }
        } else {
            // expired or inactive, treat as free
            currentUserPlan = 'free';
            currentUserLimits = { maxLinks: 5, features: { locationTracking: false, deviceTracking: false, exportData: false } };
        }
    } else {
        currentUserPlan = 'free';
        currentUserLimits = { maxLinks: 5, features: { locationTracking: false, deviceTracking: false, exportData: false } };
    }
    // Update UI to show plan badge
    planBadge.innerText = currentUserPlan === 'free' ? 'Free' : currentUserPlan === 'basic' ? 'Basic' : 'Pro';
    planBadge.className = `plan-badge ${currentUserPlan}`;
    return currentUserLimits;
}

// Modify addNewLink to check limit
async function addNewLink() {
    if (!currentUser) return;
    // Fetch current links count
    const linksSnap = await get(ref(db, `users/${currentUser.uid}/links`));
    const currentLinkCount = linksSnap.exists() ? Object.keys(linksSnap.val()).length : 0;
    if (currentLinkCount >= currentUserLimits.maxLinks) {
        alert(`You've reached your ${currentUserPlan} plan limit of ${currentUserLimits.maxLinks} links. Upgrade to add more!`);
        return;
    }
    // ... rest of addNewLink logic
}

// In renderLinks, hide analytics features based on plan
function renderLinks(linksData) {
    // ... existing code
    // Modify analytics button visibility: if basic or free, show only limited analytics? We'll keep button but when clicked, show limited modal.
}

// In showAnalytics, restrict data based on plan
async function showAnalytics(linkId, linkName) {
    // ... fetch visits
    if (currentUserPlan === 'free') {
        alert("Upgrade to Pro to see detailed analytics!");
        return;
    }
    if (currentUserPlan === 'basic') {
        // Show only basic click count, no location/device
        analyticsLinkName.innerText = linkName;
        analyticsClicks.innerText = link.clickCount || 0;
        // Hide tabs for devices, locations, visitors? Or show limited
        // We'll just show a message
        alert("Basic plan: click counts only. Upgrade to Pro for full analytics.");
        return;
    }
    // Pro: show all
    // ... full analytics code
}

// In onAuthStateChanged, after user is logged in, call fetchUserPlan
onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = "login.html";
    currentUser = user;
    await fetchUserPlan(user.uid);
    // ... rest
});

// Add an "Upgrade" button in the top bar (add HTML in index.html)
// In index.html, add after user name:
// <button id="upgradeBtn" class="upgrade-btn">Upgrade</button>
// Add event listener:
document.getElementById('upgradeBtn')?.addEventListener('click', () => window.location.href = 'premium.html');