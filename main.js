// ---------------------- Elements ----------------------
const searchInput = document.getElementById('food-input');
const recipesList = document.getElementById('recipes-list');
const voiceBtn = document.getElementById('voice-btn');
const voiceIndicator = document.getElementById('voice-indicator');

// Modal elements
const recipeModalEl = document.getElementById('recipeModal');
const recipeModal = new bootstrap.Modal(recipeModalEl);
const recipeModalTitle = document.getElementById('recipeModalTitle');
const modalImage = document.getElementById('modal-image');
const modalMealType = document.getElementById('modal-mealType');
const modalDietLabels = document.getElementById('modal-dietLabels');
const flameSelect = document.getElementById('flameSelect');
const quantitySelect = document.getElementById('quantitySelect');
const ingredientsList = document.getElementById('ingredientsList');
const cookingSteps = document.getElementById('cookingSteps');
const timedSteps = document.getElementById('timedSteps');
const stepTimer = document.getElementById('stepTimer');
const startBtn = document.getElementById('startStepsBtn');
const stopBtn = document.getElementById('stopStepsBtn');
const pauseBtn = document.getElementById('pauseStepsBtn');
const resumeBtn = document.getElementById('resumeStepsBtn');
const cookingTimeEl = document.getElementById('cookingTime');

// Auth elements
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
const signupModal = new bootstrap.Modal(document.getElementById('signupModal'));
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginLink = document.getElementById('login-link');
const signupLink = document.getElementById('signup-link');
const userGreet = document.getElementById('user-greet');
const usernameSpan = document.getElementById('username');
const logoutLink = document.getElementById('logout-link');

// ---------------------- Session / Auth ----------------------
function updateNavbar(user) {
    if (user) {
        loginLink.classList.add('d-none');
        signupLink.classList.add('d-none');
        userGreet.classList.remove('d-none');
        logoutLink.classList.remove('d-none');
        usernameSpan.textContent = `Welcome, ${user.name}`;
    } else {
        loginLink.classList.remove('d-none');
        signupLink.classList.remove('d-none');
        userGreet.classList.add('d-none');
        logoutLink.classList.add('d-none');
    }
}

let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
updateNavbar(currentUser);

loginBtn?.addEventListener('click', () => loginModal.show());
signupBtn?.addEventListener('click', () => signupModal.show());

signupForm?.addEventListener('submit', e => {
    e.preventDefault();
    const name = signupForm[0].value.trim();
    const email = signupForm[1].value.trim();
    const password = signupForm[2].value;
    let users = JSON.parse(localStorage.getItem('users')) || [];
    if (users.some(u => u.email === email)) {
        alert('Email already registered.');
        return;
    }
    users.push({ name, email, password });
    localStorage.setItem('users', JSON.stringify(users));
    alert('Signup successful. Please login.');
    signupModal.hide();
    signupForm.reset();
});

loginForm?.addEventListener('submit', e => {
    e.preventDefault();
    const email = loginForm[0].value.trim();
    const password = loginForm[1].value;
    let users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        currentUser = user;
        updateNavbar(currentUser);
        alert(`Welcome back, ${user.name}!`);
        loginModal.hide();
        loginForm.reset();
    } else {
        alert('Invalid email or password.');
    }
});

logoutLink?.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    currentUser = null;
    updateNavbar(null);
});

// ---------------------- Recipe search ----------------------
const EDAMAM_APP_ID = '09c9432e';
const EDAMAM_APP_KEY = '9fd4ad6664f10395496d92698980d8cf';

searchInput.addEventListener('keyup', async e => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
        const q = e.target.value.trim();
        recipesList.innerHTML = '';
        await fetchRecipe(q);
    }
});

async function fetchRecipe(query) {
    const URL = `https://api.edamam.com/api/recipes/v2?type=public&q=${encodeURIComponent(query)}&app_id=${EDAMAM_APP_ID}&app_key=${EDAMAM_APP_KEY}`;
    try {
        const res = await fetch(URL);
        if (!res.ok) throw new Error('API error');
        const json = await res.json();
        const hits = json.hits.slice(0, 8);
        hits.forEach(h => createRecipeCard(h));
    } catch (err) {
        console.error(err);
        recipesList.innerHTML = '<li class="col-12">No recipes found or API error.</li>';
    }
}

function createRecipeCard(hit) {
    const data = hit.recipe;
    const li = document.createElement('li');
    li.className = 'col';
    li.innerHTML = `
        <div class="card h-100">
            <img src="${data.image}" class="card-img-top" alt="${escapeHtml(data.label)}">
            <div class="card-body d-flex flex-column">
                <h5 class="card-title">${escapeHtml(data.label)}</h5>
                <p class="card-text text-muted mb-2">${escapeHtml(data.mealType?.[0] || '')}</p>
                <div class="mt-auto">
                    <button class="btn btn-sm btn-primary w-100 view-btn">View</button>
                </div>
            </div>
        </div>
    `;
    li.querySelector('.view-btn').addEventListener('click', () => showRecipeModal(hit));
    recipesList.appendChild(li);
}

function escapeHtml(s) {
    return String(s).replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// ---------------------- Modal: show recipe ----------------------
let currentRecipe = null;
const BASE_STEP_MINUTES = 2;

function showRecipeModal(hit) {
    currentRecipe = hit.recipe;
    recipeModalTitle.textContent = currentRecipe.label;
    modalImage.src = currentRecipe.image || '';
    modalMealType.textContent = currentRecipe.mealType?.[0] || 'N/A';
    modalDietLabels.textContent = (currentRecipe.dietLabels || []).join(', ') || 'None';
    flameSelect.value = 'Medium';
    quantitySelect.value = '1';
    renderIngredients(1);
    renderSteps();
    updateCookingTime();
    clearRunningTimer();
    recipeModal.show();
}

function renderIngredients(multiplier) {
    const lines = currentRecipe.ingredientLines || [];
    ingredientsList.innerHTML = lines.map(line => {
        const replaced = line.replace(/\d+(\.\d+)?|\d+\/\d+/g, num => {
            if (num.includes('/')) {
                const [n, d] = num.split('/').map(Number);
                return (n / d * multiplier).toFixed(2);
            } else return (parseFloat(num) * multiplier).toFixed(2);
        });
        return `<li>${escapeHtml(replaced)}</li>`;
    }).join('');
}

function renderSteps() {
    const lines = currentRecipe.ingredientLines || [];
    cookingSteps.innerHTML = lines.map(line => `<li>${escapeHtml(line)}</li>`).join('');
}

function updateCookingTime() {
    const baseTime = currentRecipe.totalTime || 20;
    const flameMult = flameMultiplierFor(flameSelect.value);
    const qty = parseFloat(quantitySelect.value) || 1;
    const total = Math.round(baseTime * flameMult * qty);
    cookingTimeEl.textContent = `Estimated Cooking Time: ${total} min`;
}

function flameMultiplierFor(flame) {
    if (flame === 'Low') return 1.5;
    if (flame === 'High') return 0.7;
    return 1.0;
}

quantitySelect.addEventListener('change', () => {
    renderIngredients(parseFloat(quantitySelect.value));
    updateCookingTime();
});

flameSelect.addEventListener('change', updateCookingTime);

// ---------------------- Step-by-step timer ----------------------
let stepIntervalId = null;
let currentStepIndex = 0;
let stepsArray = [];
let remainingSec = 0;
let isPaused = false;

function clearRunningTimer() {
    if (stepIntervalId) clearInterval(stepIntervalId);
    stepIntervalId = null;
    currentStepIndex = 0;
    stepsArray = [];
    remainingSec = 0;
    isPaused = false;
    timedSteps.innerHTML = '';
    stepTimer.textContent = '';
    startBtn.disabled = false;
    pauseBtn.classList.add('d-none');
    resumeBtn.classList.add('d-none');
}

startBtn.addEventListener('click', () => startAllSteps());
pauseBtn.addEventListener('click', () => pauseStep());
resumeBtn.addEventListener('click', () => resumeStep());
stopBtn.addEventListener('click', () => stopAllSteps());

function startAllSteps() {
    if (stepIntervalId) return;
    const qty = parseFloat(quantitySelect.value) || 1;
    const flameMult = flameMultiplierFor(flameSelect.value);
    const lines = currentRecipe.ingredientLines || [];
    stepsArray = lines.map(line => {
        const minutes = BASE_STEP_MINUTES * flameMult * qty;
        return { text: line, timeSec: Math.max(1, Math.round(minutes * 60)) };
    });
    timedSteps.innerHTML = stepsArray.map((s, idx) =>
        `<li id="timed-step-${idx}">${escapeHtml(s.text)} <small class="text-muted">— ${formatSec(s.timeSec)}</small></li>`
    ).join('');
    currentStepIndex = 0;
    startStep(currentStepIndex);
    startBtn.disabled = true;
    pauseBtn.classList.remove('d-none');
}

function pauseStep() {
    if (stepIntervalId && !isPaused) {
        clearInterval(stepIntervalId);
        isPaused = true;
        stepTimer.textContent += ' (Paused)';
        pauseBtn.classList.add('d-none');
        resumeBtn.classList.remove('d-none');
    }
}

function resumeStep() {
    if (isPaused) {
        isPaused = false;
        startStep(currentStepIndex, remainingSec);
        pauseBtn.classList.remove('d-none');
        resumeBtn.classList.add('d-none');
    }
}

function stopAllSteps() {
    clearRunningTimer();
    stepTimer.textContent = 'Timer stopped.';
}

function startStep(idx, remaining = null) {
    if (idx >= stepsArray.length) {
        stepTimer.textContent = 'All steps finished ✅';
        stepIntervalId = null;
        startBtn.disabled = false;
        pauseBtn.classList.add('d-none');
        resumeBtn.classList.add('d-none');
        return;
    }

    const stepElem = document.getElementById(`timed-step-${idx}`);
    remainingSec = remaining !== null ? remaining : stepsArray[idx].timeSec;
    updateStepUI(idx);
    stepTimer.textContent = `Step ${idx + 1}/${stepsArray.length}: ${escapeHtml(stepsArray[idx].text)} — ${formatSec(remainingSec)}`;

    if (stepIntervalId) clearInterval(stepIntervalId);

    stepIntervalId = setInterval(() => {
        if (isPaused) return;
        remainingSec--;
        if (remainingSec <= 0) {
            clearInterval(stepIntervalId);
            stepIntervalId = null;
            stepElem?.classList.add('text-decoration-line-through', 'text-success');
            currentStepIndex++;
            startStep(currentStepIndex);
            return;
        }
        stepTimer.textContent = `Step ${idx + 1}/${stepsArray.length}: ${escapeHtml(stepsArray[idx].text)} — ${formatSec(remainingSec)}`;
    }, 1000);
}

function updateStepUI(idx) {
    stepsArray.forEach((_, i) => {
        const el = document.getElementById(`timed-step-${i}`);
        if (!el) return;
        if (i === idx) el.classList.add('fw-bold');
        else el.classList.remove('fw-bold');
    });
}

function formatSec(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

recipeModalEl.addEventListener('hidden.bs.modal', clearRunningTimer);

// ---------------------- Voice Search ----------------------
let recognition = null;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    voiceBtn?.addEventListener('click', () => {
        if (voiceBtn.classList.contains('active')) recognition.stop();
        else recognition.start();
    });

    recognition.addEventListener('start', () => {
        voiceBtn.classList.add('active');
        voiceIndicator.classList.remove('d-none');
    });

    recognition.addEventListener('end', () => {
        voiceBtn.classList.remove('active');
        voiceIndicator.classList.add('d-none');
    });

    recognition.addEventListener('result', async e => {
        const transcript = e.results[0][0].transcript;
        searchInput.value = transcript;
        recipesList.innerHTML = '';
        await fetchRecipe(transcript);
    });
} else {
    console.warn('Voice recognition not supported in this browser.');
}
