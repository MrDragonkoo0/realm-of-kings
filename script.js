let houses = 0;
let building = false;


function nextStep() {

    const kingdom = document.getElementById("kingdomName").value.trim();

    if (kingdom === "") {
        alert("Введи назву королівства!");
        return;
    }

    document.getElementById("step1").style.display = "none";
    document.getElementById("step2").style.display = "block";
}


function createKingdom() {

    const kingdom = document.getElementById("kingdomName").value.trim();
    const ruler = document.getElementById("rulerName").value.trim();

    if (ruler === "") {
        alert("Введи ім'я правителя!");
        return;
    }

    // Зберігаємо дані
    localStorage.setItem("registered", "true");
    localStorage.setItem("kingdomName", kingdom);
    localStorage.setItem("rulerName", ruler);

    openGame(kingdom, ruler);
}

function showCities() {
    document.getElementById("game").innerHTML = `
        <h1>🏘️ Міста</h1>

        <div class="menu">
            <button onclick="showCapital()">🏰 Столиця</button>
            <button>🏘️ Нове місто</button>
            <button onclick="showKingdom()">⬅️ Назад</button>
        </div>
    `;
}

function showCapital() {
    document.getElementById("game").innerHTML = `
        <h1>🏰 Столиця</h1>

        <p>👥 Населення: 0</p>
        <p>🏛️ Ратуша I рівень</p>
        <p>🏦 Казна I рівень</p>
        <p>📦 Склад I рівень</p>
        <p>🏪 Ринок I рівень</p>
        <p>🏰 Стіни I рівень</p>
        <p>🚪 Ворота I рівень</p>
        <p>🏠 Будинки: ${houses}</p>

        <div class="menu">
            <button onclick="showConstruction()">🔨 БУДІВНИЦТВО</button>
            <button onclick="showCities()">⬅️ НАЗАД</button>
        </div>
    `;
}

function showKingdom() {

    const kingdom = localStorage.getItem("kingdomName");
    const ruler = localStorage.getItem("rulerName");

    document.getElementById("game").innerHTML = `
        <h1>🏰 МОЄ КОРОЛІВСТВО 🏰</h1>

        <div class="kingdom">
            <h2>🏰 ${kingdom}</h2>
            <p>👑 ${ruler}</p>

            <div class="level">
                <span>📈 Рівень 1</span>
                <span>0 / 100 XP</span>
            </div>

            <div class="xp">
                <div class="xp-fill"></div>
            </div>
        </div>

        <div class="stats">
            <div>👥<br><b>0</b></div>
            <div>💰<br><b>0</b></div>
            <div>⚔️<br><b>0</b></div>
            <div>🏘️<br><b>0</b></div>
            <div>🏠<br><b>0</b></div>
            <div>💎<br><b>0</b></div>
        </div>

        <div class="menu">
            <button onclick="showCities()">🏘️ МІСТА</button>
            <button onclick="showVillages()">🏠 СЕЛА</button>

            <button onclick="showArmy()">⚔️ ВІЙСЬКА</button>
            <button onclick="showTreasury()">💰 КАЗНА</button>

            <button onclick="showPopulation()">👥 ЛЮДИ</button>
            <button onclick="showWarehouse()">📦 СКЛАД</button>
        </div>
    `;
}

function showWarehouse() {
    document.getElementById("game").innerHTML = `
        <h1>📦 Склад</h1>

        <p>🪨 Камінь: 0</p>
        <p>🪵 Дерево: 0</p>
        <p>⛓️ Залізо: 0</p>
        <p>🌾 Солома: 0</p>
        <p>🧱 Цегла: 0</p>
        <p>🏺 Глина: 0</p>
        <p>🏖️ Пісок: 0</p>

        <hr>

        <p>🍞 Хліб: 0</p>
        <p>🥩 М'ясо: 0</p>
        <p>🌾 Борошно: 0</p>
        <p>🥕 Морква: 0</p>
        <p>🥔 Картопля: 0</p>
        <p>💧 Вода: 0</p>
        <p>🍎 Яблука: 0</p>

        <button onclick="showKingdom()">⬅️ Назад</button>
    `;
}

function showArmy() {
    document.getElementById("game").innerHTML = `
        <h1>⚔️ Армія</h1>

        <p>🗡️ Мечники: 0</p>
        <p>🏹 Лучники: 0</p>
        <p>🛡️ Щитоносці: 0</p>
        <p>🐎 Легка кіннота: 0</p>
        <p>🛡️ Лицарі: 0</p>

        <hr>

        <p>💪 Військова сила: 0</p>

        <button onclick="showKingdom()">⬅️ Назад</button>
    `;
}
function openGame(kingdom, ruler) {

    document.getElementById("registration").style.display = "none";
    document.getElementById("game").style.display = "block";

    document.querySelector(".kingdom h2").textContent =
        "🏰 " + kingdom;

    document.querySelector(".kingdom p").textContent =
        "👑 " + ruler;
}


// Перевіряємо, чи гравець уже реєструвався
window.addEventListener("load", function () {

    const registered = localStorage.getItem("registered");

    if (registered === "true") {

        const kingdom = localStorage.getItem("kingdomName");
        const ruler = localStorage.getItem("rulerName");

        openGame(kingdom, ruler);

    } else {

        document.getElementById("registration").style.display = "block";
        document.getElementById("game").style.display = "none";
    }
});
function showConstruction() {

    document.getElementById("game").innerHTML = `

        <h1>🔨 Будівництво</h1>

        <div class="menu">

            <button onclick="showHouse()">
                🏠 Будинки
                <span id="houseTimer"></span>
            </button>

            <button onclick="showSmithy()">
                ⚒️ Кузня
                <span id="smithyTimer"></span>
            </button>

            <button onclick="showFarm()">
                🌾 Ферма
                <span id="farmTimer"></span>
            </button>

            <button onclick="showStable()">
                🐴 Конюшня
                <span id="stableTimer"></span>
            </button>

            <button onclick="showBarracks()">
                🛡️ Казарми
                <span id="barracksTimer"></span>
            </button>

            <button onclick="showRange()">
                🏹 Стрільбище
                <span id="rangeTimer"></span>
            </button>

            <button onclick="showTemple()">
                ⛪ Храм
                <span id="templeTimer"></span>
            </button>

            <button onclick="showBakery()">
                🍞 Пекарня
                <span id="bakeryTimer"></span>
            </button>

            <button onclick="showWorkshop()">
                🧵 Майстерня
                <span id="workshopTimer"></span>
            </button>

            <button onclick="showHospital()">
                🏥 Лікарня
                <span id="hospitalTimer"></span>
            </button>

            <button onclick="showCapital()">
                ⬅️ НАЗАД
            </button>

        </div>
    `;

    // Після створення HTML відновлюємо таймер
    updateBuildingTimer();
}
function showHouse() {
    document.getElementById("game").innerHTML = `
        <h1>🏠 Будинки</h1>

        <p>🪵 Дерево: 15</p>
        <p>🪨 Камінь: 10</p>
        <p>🧱 Цегла: 10</p>

        <hr>

        <p>⏱️ Час будівництва: 5 хв</p>

        <div class="menu">
            <button onclick="startHouseBuild()">🔨 ПОБУДУВАТИ</button>
            <button onclick="showConstruction()">⬅️ НАЗАД</button>
        </div>
    `;
}


function showSmithy() {
    document.getElementById("game").innerHTML = `
        <h1>⚒️ Кузня</h1>

        <p>🪵 Дерево: 10</p>
        <p>🪨 Камінь: 15</p>
        <p>⛓️ Залізо: 5</p>
        <p>🏺 Глина: 5</p>

        <hr>

        <p>⏱️ Час будівництва: 20 хв</p>

        <div class="menu">
            <button onclick="startSmithyBuild()">🔨 ПОБУДУВАТИ</button>
            <button onclick="showConstruction()">⬅️ НАЗАД</button>
        </div>
    `;
}


function showFarm() {
    document.getElementById("game").innerHTML = `
        <h1>🌾 Ферма</h1>

        <p>🪵 Дерево: 5</p>
        <p>🪨 Камінь: 10</p>
        <p>🌾 Солома: 25</p>

        <hr>

        <p>⏱️ Час будівництва: 15 хв</p>

        <div class="menu">
            <button onclick="startFarmBuild()">🔨 ПОБУДУВАТИ</button>
            <button onclick="showConstruction()">⬅️ НАЗАД</button>
        </div>
    `;
}


function showStable() {
    document.getElementById("game").innerHTML = `
        <h1>🐴 Конюшня</h1>

        <p>🪵 Дерево: 30</p>
        <p>🪨 Камінь: 50</p>
        <p>🌾 Солома: 25</p>
        <p>⛓️ Залізо: 10</p>
        <p>🏺 Глина: 10</p>
        <p>🧱 Цегла: 20</p>

        <hr>

        <p>⏱️ Час будівництва: 40 хв</p>

        <div class="menu">
            <button onclick="startStableBuild()">🔨 ПОБУДУВАТИ</button>
            <button onclick="showConstruction()">⬅️ НАЗАД</button>
        </div>
    `;
}


function showBarracks() {
    document.getElementById("game").innerHTML = `
        <h1>🛡️ Казарми</h1>

        <p>🪵 Дерево: 25</p>
        <p>🪨 Камінь: 30</p>
        <p>⛓️ Залізо: 15</p>

        <hr>

        <p>⏱️ Час будівництва: 30 хв</p>

        <div class="menu">
            <button onclick="startBarracksBuild()">🔨 ПОБУДУВАТИ</button>
            <button onclick="showConstruction()">⬅️ НАЗАД</button>
        </div>
    `;
}


function showRange() {
    document.getElementById("game").innerHTML = `
        <h1>🏹 Стрільбище</h1>

        <p>🪵 Дерево: 20</p>
        <p>🪨 Камінь: 20</p>
        <p>⛓️ Залізо: 10</p>

        <hr>

        <p>⏱️ Час будівництва: 25 хв</p>

        <div class="menu">
            <button onclick="startRangeBuild()">🔨 ПОБУДУВАТИ</button>
            <button onclick="showConstruction()">⬅️ НАЗАД</button>
        </div>
    `;
}


function showTemple() {
    document.getElementById("game").innerHTML = `
        <h1>⛪ Храм</h1>

        <p>🪵 Дерево: 20</p>
        <p>🪨 Камінь: 35</p>
        <p>🧱 Цегла: 20</p>

        <hr>

        <p>⏱️ Час будівництва: 35 хв</p>

        <div class="menu">
            <button onclick="startTempleBuild()">🔨 ПОБУДУВАТИ</button>
            <button onclick="showConstruction()">⬅️ НАЗАД</button>
        </div>
    `;
}


function showBakery() {
    document.getElementById("game").innerHTML = `
        <h1>🍞 Пекарня</h1>

        <p>🪵 Дерево: 15</p>
        <p>🪨 Камінь: 15</p>
        <p>🧱 Цегла: 15</p>
        <p>🏺 Глина: 5</p>

        <hr>

        <p>⏱️ Час будівництва: 20 хв</p>

        <div class="menu">
            <button onclick="startBakeryBuild()">🔨 ПОБУДУВАТИ</button>
            <button onclick="showConstruction()">⬅️ НАЗАД</button>
        </div>
    `;
}


function showWorkshop() {
    document.getElementById("game").innerHTML = `
        <h1>🧵 Майстерня</h1>

        <p>🪵 Дерево: 20</p>
        <p>🪨 Камінь: 15</p>
        <p>⛓️ Залізо: 10</p>

        <hr>

        <p>⏱️ Час будівництва: 25 хв</p>

        <div class="menu">
            <button onclick="startWorkshopBuild()">🔨 ПОБУДУВАТИ</button>
            <button onclick="showConstruction()">⬅️ НАЗАД</button>
        </div>
    `;
}


function showHospital() {
    document.getElementById("game").innerHTML = `
        <h1>🏥 Лікарня</h1>

        <p>🪵 Дерево: 25</p>
        <p>🪨 Камінь: 30</p>
        <p>🧱 Цегла: 20</p>

        <hr>

        <p>⏱️ Час будівництва: 40 хв</p>

        <div class="menu">
            <button onclick="startHospitalBuild()">🔨 ПОБУДУВАТИ</button>
            <button onclick="showConstruction()">⬅️ НАЗАД</button>
        </div>
    `;
}
// ===============================
// 🏗️ СИСТЕМА БУДІВНИЦТВА
// ===============================

let building = false;
let currentBuilding = "";
let buildingTime = 0;
let buildingTimerInterval;


// Початок будівництва
function startBuilding(type, seconds) {

    // Якщо вже щось будується
    if (building) {
        return;
    }

    building = true;
    currentBuilding = type;
    buildingTime = seconds;

    // Одразу повертаємося до списку будівництва
    showConstruction();

    updateBuildingTimer();

    buildingTimerInterval = setInterval(function () {

        buildingTime--;

        updateBuildingTimer();

        if (buildingTime <= 0) {

            clearInterval(buildingTimerInterval);

            building = false;

            // Будинок додається після завершення
            if (currentBuilding === "house") {
                houses++;
            }

            currentBuilding = "";

            showConstruction();
        }

    }, 1000);
}


// ===============================
// ⏱️ ОНОВЛЕННЯ ТАЙМЕРА
// ===============================

function updateBuildingTimer() {

    if (!building) {
        return;
    }

    const timer = document.getElementById(
        currentBuilding + "Timer"
    );

    if (!timer) {
        return;
    }

    const minutes = Math.floor(buildingTime / 60);
    const seconds = buildingTime % 60;

    timer.textContent =
        " ⏱️ " +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0");
}
