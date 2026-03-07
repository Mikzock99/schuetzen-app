import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, onSnapshot, getDocs, deleteDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
const firebaseConfig = {
    apiKey: "AIzaSyDxoCw9A-4na-AmPE3_IyiXHIW4ew3djFU",
    authDomain: "schuetzenapp-b10bd.firebaseapp.com",
    projectId: "schuetzenapp-b10bd",
    storageBucket: "schuetzenapp-b10bd.firebasestorage.app",
    messagingSenderId: "703283993031",
    appId: "1:703283993031:web:70c8bff98941e68c44e1e2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const TRAINER_EMAIL = "kunzemike6@gmail.com";
let leaderboardData = [];
let isTrainer = false;

// Echtzeit-Listener für die Bestenliste
onSnapshot(collection(db, "leaderboard"), (snapshot) => {
    console.log('[Firestore] Leaderboard Snapshot erhalten');
    leaderboardData = [];
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        leaderboardData.push({
            id: docSnap.id,
            name: data.name,
            score: data.score,
            series: data.series,
            date: data.date
        });
    });
    renderLeaderboard();
}, (error) => {
    console.error("[Firestore Error] Leaderboard-Listener fehlgeschlagen:", error);
    if (error.code === 'permission-denied') {
        showToast("Zugriff verweigert. Bitte prüfe die Firebase-Regeln.", "error");
    } else {
        showToast("Fehler beim Laden der Bestenliste.", "error");
    }
});
// --------------------------

function formatDate(isoString) {
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()} - ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} Uhr`;
}

// UI Elemente
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const leaderboardList = document.getElementById('leaderboard-list');
const scoreForm = document.getElementById('score-form');
const shooterNameInput = document.getElementById('shooter-name');
const nameSuggestions = document.getElementById('name-suggestions');
const serieInputs = document.querySelectorAll('.serie-input');
const totalScoreValue = document.getElementById('total-score-value');

// Auth UI Elemente
const loginContainer = document.getElementById('login-container');
const profileContainer = document.getElementById('profile-container');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authNameGroup = document.getElementById('name-group');
const authNameInput = document.getElementById('auth-name');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const btnAuthSubmit = document.getElementById('btn-auth-submit');
const btnToggleAuth = document.getElementById('btn-toggle-auth');
const navProfileText = document.getElementById('nav-profile-text');
const btnLogout = document.getElementById('btn-logout');
const profileNameDisplay = document.getElementById('profile-name-display');
const profileEmailDisplay = document.getElementById('profile-email-display');
const personalHistoryList = document.getElementById('personal-history-list');

let isLoginMode = true;
let currentUser = null;
let personalHistoryUnsubscribe = null;

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetId = item.getAttribute('data-target');
        if (!targetId) return;

        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        views.forEach(view => {
            if (view.id === targetId) {
                view.classList.add('active');
            } else {
                view.classList.remove('active');
            }
        });

        if (targetId === 'view-leaderboard') {
            renderLeaderboard();
        } else if (targetId === 'view-submit') {
            if (currentUser) {
                shooterNameInput.value = currentUser.displayName || currentUser.email.split('@')[0];
                // Optional: Readonly setzen, damit Schützen nur für sich eintragen
                // shooterNameInput.setAttribute('readonly', true);
            }
        }
    });
});

function renderLeaderboard() {
    leaderboardList.innerHTML = '';
    const sortedData = [...leaderboardData].sort((a, b) => b.score - a.score);

    if (sortedData.length === 0) {
        leaderboardList.innerHTML = '<p style="text-align:center; color: var(--text-muted); margin-top:2rem;">Noch keine Ergebnisse eingetragen.</p>';
        return;
    }

    sortedData.forEach((entry, index) => {
        const rank = index + 1;
        const delay = index * 0.1;

        const li = document.createElement('li');
        li.className = `leaderboard-item rank-${rank}`;
        li.style.animationDelay = `${delay}s`;

        const seriesText = entry.series ? `Serien: ${entry.series.join(' | ')}` : '';

        // Löschen-Button nur für Trainer
        const deleteBtnHtml = isTrainer ? `
            <button class="btn-delete-entry" data-id="${entry.id}" title="Eintrag löschen">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
        ` : '';

        li.innerHTML = `
            <div class="rank">${rank}</div>
            <div class="shooter-info">
                <span class="shooter-name">${entry.name} ${entry.uid !== 'anonymous' ? '<span class="trainer-only-badge" style="background:#555; font-size: 0.6rem;">REG.</span>' : ''}</span>
                <span class="shooter-date">Letztes Training: ${formatDate(entry.date)}</span>
                ${seriesText ? `<span class="shooter-date" style="color: var(--primary); margin-top: 2px;">${seriesText}</span>` : ''}
            </div>
            <div class="score">${entry.score}</div>
            ${deleteBtnHtml}
        `;

        if (isTrainer) {
            const btn = li.querySelector('.btn-delete-entry');
            btn.addEventListener('click', () => deleteEntry(entry.id, entry.name));
        }

        leaderboardList.appendChild(li);
    });
}

async function deleteEntry(id, name) {
    if (confirm(`Möchtest du das Ergebnis von ${name} wirklich löschen?`)) {
        try {
            await deleteDoc(doc(db, "leaderboard", id));
            showToast(`Ergebnis von ${name} wurde gelöscht.`);
        } catch (error) {
            console.error("Fehler beim Löschen des Eintrags:", error);
            showToast("Fehler beim Löschen.", "error");
        }
    }
}

shooterNameInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    nameSuggestions.innerHTML = '';

    if (val.length === 0) {
        nameSuggestions.classList.add('hidden');
        return;
    }

    const knownNames = Array.from(new Set(leaderboardData.map(d => d.name)));
    const matches = knownNames.filter(name => name.toLowerCase().includes(val));

    if (matches.length > 0) {
        nameSuggestions.classList.remove('hidden');
        matches.forEach(match => {
            const li = document.createElement('li');
            li.className = 'suggestion-item';
            li.textContent = match;
            li.addEventListener('click', () => {
                shooterNameInput.value = match;
                nameSuggestions.classList.add('hidden');
            });
            nameSuggestions.appendChild(li);
        });
    } else {
        nameSuggestions.classList.add('hidden');
    }
});

function updateTotal() {
    let total = 0;
    serieInputs.forEach(input => {
        const val = parseInt(input.value, 10);
        if (!isNaN(val)) total += val;
    });
    totalScoreValue.textContent = total;
    return total;
}

serieInputs.forEach(input => {
    input.addEventListener('input', updateTotal);
});

scoreForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = shooterNameInput.value.trim();
    let hasError = false;
    let seriesScores = [];

    serieInputs.forEach(input => {
        const val = parseInt(input.value, 10);
        if (isNaN(val) || val < 0 || val > 100) {
            hasError = true;
        }
        seriesScores.push(val);
    });

    if (hasError) {
        showToast('Fehler: Jede Serie muss zwischen 0 und 100 Ringe haben!', 'error');
        return;
    }

    const sc = updateTotal();

    try {
        const docId = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
        await setDoc(doc(db, "leaderboard", docId), {
            name: name,
            score: sc,
            series: seriesScores,
            date: new Date().toISOString(),
            uid: currentUser ? currentUser.uid : 'anonymous'
        });

        showToast(`Erfolgreich! ${sc} Ringe für ${name} eingetragen.`);
        scoreForm.reset();
        totalScoreValue.textContent = "0";

        setTimeout(() => {
            document.querySelector('[data-target="view-leaderboard"]').click();
        }, 1500);
    } catch (error) {
        console.error("Fehler beim Speichern in Firestore: ", error);
        showToast("Fehler beim Speichern in der Datenbank.", "error");
    }
});

// --- Teilen und Löschen Logik ---
document.getElementById('btn-share-leaderboard').addEventListener('click', async () => {
    const sortedData = [...leaderboardData].sort((a, b) => b.score - a.score);

    if (sortedData.length === 0) {
        showToast('Keine Ergebnisse zum Teilen vorhanden!', 'error');
        return;
    }

    let textToShare = "🎯 *Schützenjugend Bestenliste*\n\n";
    sortedData.forEach((entry, idx) => {
        const s = entry.series ? `(${entry.series.join('|')})` : '';
        textToShare += `${idx + 1}. ${entry.name}: *${entry.score}* ${s}\n`;
    });
    textToShare += "\nStand: " + formatDate(new Date().toISOString());

    // Native Share API wenn verfügbar (Handy), ansonsten in die Zwischenablage kopieren (PC)
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Schützenjugend Ergebnisse',
                text: textToShare,
            });
            showToast('Erfolgreich geteilt!');
        } catch (err) {
            console.log("Teilen abgebrochen");
        }
    } else {
        navigator.clipboard.writeText(textToShare).then(() => {
            showToast('Ergebnisse in die Zwischenablage kopiert! Du kannst sie jetzt z.B. in WhatsApp einfügen.');
        }).catch(err => {
            showToast('Kopieren fehlgeschlagen.', 'error');
        });
    }
});

document.getElementById('btn-clear-data').addEventListener('click', async () => {
    if (confirm('ACHTUNG: Möchtest du wirklich alle eingetragenen Ergebnisse in der Cloud löschen? Dies kann nicht rückgängig gemacht werden und löscht die Daten für ALLE Nutzer.')) {
        try {
            const querySnapshot = await getDocs(collection(db, "leaderboard"));
            const deletePromises = [];
            querySnapshot.forEach((document) => {
                deletePromises.push(deleteDoc(doc(db, "leaderboard", document.id)));
            });
            await Promise.all(deletePromises);

            showToast('Alle Daten erfolgreich gelöscht.');
        } catch (error) {
            console.error("Fehler beim Löschen: ", error);
            showToast('Fehler beim Löschen der Daten.', 'error');
        }
    }
});

// --- Authentication & Profil Logik ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    isTrainer = user && user.email === TRAINER_EMAIL;

    // UI für Trainer anpassen
    document.querySelectorAll('.trainer-only').forEach(el => {
        if (isTrainer) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    if (user) {
        // Eingeloggt -> Zeige Profil, verstecke Login
        loginContainer.style.display = 'none';
        profileContainer.style.display = 'block';
        navProfileText.textContent = isTrainer ? 'Trainer' : 'Profil';

        profileNameDisplay.innerHTML = (user.displayName || 'Schütze') + (isTrainer ? ' <span class="trainer-only-badge">TRAINER</span>' : '');
        profileEmailDisplay.textContent = user.email;

        loadPersonalHistory(user.uid);
    } else {
        // Ausgeloggt -> Zeige Login, verstecke Profil
        loginContainer.style.display = 'block';
        profileContainer.style.display = 'none';
        navProfileText.textContent = 'Login';

        if (personalHistoryUnsubscribe) {
            personalHistoryUnsubscribe();
        }
    }

    // Leaderboard neu rendern, um Löschen-Buttons zu zeigen/verstecken
    renderLeaderboard();
});

btnToggleAuth.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;

    if (isLoginMode) {
        authTitle.textContent = 'Anmelden';
        btnAuthSubmit.querySelector('span').textContent = 'Anmelden';
        btnToggleAuth.textContent = 'Noch kein Account? Hier registrieren';
        authNameGroup.style.display = 'none';
        authNameInput.required = false;
    } else {
        authTitle.textContent = 'Neu Registrieren';
        btnAuthSubmit.querySelector('span').textContent = 'Registrieren';
        btnToggleAuth.textContent = 'Bereits einen Account? Hier anmelden';
        authNameGroup.style.display = 'block';
        authNameInput.required = true;
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value.trim();

    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, password);
            showToast('Erfolgreich angemeldet!');
        } else {
            const name = authNameInput.value.trim();
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            showToast('Account erfolgreich erstellt und angemeldet!');
        }
        authForm.reset();
    } catch (error) {
        console.error("Auth Exception:", error);
        let msg = 'Fehler bei der Anmeldung.';
        if (error.code === 'auth/email-already-in-use') msg = 'Diese E-Mail wird bereits verwendet.';
        else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') msg = 'E-Mail oder Passwort falsch.';
        else if (error.code === 'auth/weak-password') msg = 'Das Passwort muss mindestens 6 Zeichen lang sein.';
        else if (error.code === 'auth/operation-not-allowed') msg = 'Login-Methode ist in Firebase nicht aktiviert.';
        else if (error.code === 'auth/unauthorized-domain') msg = 'Diese Domain (localhost/127.0.0.1) ist in Firebase nicht erlaubt.';
        else msg = `Fehler: ${error.message} (${error.code})`;

        showToast(msg, 'error');
    }
});

btnLogout.addEventListener('click', async () => {
    try {
        await signOut(auth);
        showToast('Erfolgreich abgemeldet.');
    } catch (error) {
        showToast('Fehler beim Abmelden.', 'error');
    }
});

function loadPersonalHistory(uid) {
    personalHistoryList.innerHTML = '<div class="loading-spinner"></div>';

    if (personalHistoryUnsubscribe) {
        personalHistoryUnsubscribe();
    }

    const q = query(collection(db, "leaderboard"), where("uid", "==", uid));

    personalHistoryUnsubscribe = onSnapshot(q, (snapshot) => {
        console.log('[Firestore] Personal History Snapshot erhalten');
        personalHistoryList.innerHTML = '';

        if (snapshot.empty) {
            personalHistoryList.innerHTML = '<p style="text-align:center; color: var(--text-muted); margin-top:1rem;">Du hast noch keine Ergebnisse eingetragen.</p>';
            return;
        }

        const historyData = [];
        snapshot.forEach(docSnap => historyData.push({ id: docSnap.id, ...docSnap.data() }));
        historyData.sort((a, b) => new Date(b.date) - new Date(a.date)); // Neueste zuerst

        historyData.forEach(entry => {
            const li = document.createElement('li');
            li.style.background = 'rgba(0,0,0,0.3)';
            li.style.border = '1px solid var(--card-border)';
            li.style.borderRadius = '12px';
            li.style.padding = '1rem';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';

            const seriesText = entry.series ? `Serien: ${entry.series.join(' | ')}` : '';

            li.innerHTML = `
                <div>
                    <span style="display:block; font-weight: 600;">${formatDate(entry.date)}</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted)">${seriesText}</span>
                </div>
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);">${entry.score}</div>
            `;
            personalHistoryList.appendChild(li);
        });
    }, (error) => {
        console.error("[Firestore Error] Personal History fehlgeschlagen:", error);
        personalHistoryList.innerHTML = '<p style="text-align:center; color: var(--danger); margin-top:1rem;">Fehler beim Laden der Historie.</p>';
    });
}
// ------------------------------

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 3000);
}

