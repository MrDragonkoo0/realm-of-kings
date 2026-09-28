// Realm of Kings - script.js
let houses = 0;
let building = false;
let currentBuilding = "";
let buildingTime = 0;
let buildingTimerInterval = null;

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
    localStorage.setItem("registered", "true");
    localStorage.setItem("kingdomName", kingdom);
    localStorage.setItem("rulerName", ruler);
    openGame(kingdom, ruler);
}

function openGame() {
    document.getElementById("registration").style.display = "none";
    document.getElementById("game").style.display = "block";
    showKingdom();
}

function showKingdom() {
    const kingdom = localStorage.getItem("kingdomName") || "Dragon Kingdom";
    const ruler = localStorage.getItem("rulerName") || "Саша";

    document.getElementById("game").innerHTML = `
        <h1>🏰 МОЄ КОРОЛІВСТВО 🏰</h1>
        <div class="kingdom">
            <h2>🏰 ${kingdom}</h2>
            <p>👑 ${ruler}</p>
            <div class="level"><span>📈 Рівень 1</span><span>0 / 100 XP</span></div>
            <div class="xp"><div class="xp-fill"></div></div>
        </div>
        <div class="stats">
            <div>👥<br><b>0</b></div>
            <div>💰<br><b>0</b></div>
            <div>⚔️<br><b>0</b></div>
            <div>🏘️<br><b>0</b></div>
            <div>🏠<br><b>${houses}</b></div>
            <div>💎<br><b>0</b></div>
        </div>
        <div class="menu">
            <button onclick="showCities()">🏘️ МІСТА</button>
            <button onclick="showVillages()">🏠 СЕЛА</button>
            <button onclick="showArmy()">⚔️ ВІЙСЬКА</button>
            <button onclick="showTreasury()">💰 КАЗНА</button>
            <button onclick="showPopulation()">👥 ЛЮДИ</button>
            <button onclick="showWarehouse()">📦 СКЛАД</button>
        </div>`;
}

function showCities() {
    document.getElementById("game").innerHTML = `
        <h1>🏘️ Міста</h1>
        <div class="menu">
            <button onclick="showCapital()">🏰 Столиця</button>
            <button>🏘️ Нове місто</button>
            <button onclick="showKingdom()">⬅️ Назад</button>
        </div>`;
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
        </div>`;
}

function showConstruction() {
    document.getElementById("game").innerHTML = `
        <h1>🔨 Будівництво</h1>
        <div class="menu">
            <button onclick="showHouse()">🏠 Будинки <span id="houseTimer"></span></button>
            <button onclick="showSmithy()">⚒️ Кузня <span id="smithyTimer"></span></button>
            <button onclick="showFarm()">🌾 Ферма <span id="farmTimer"></span></button>
            <button onclick="showStable()">🐴 Конюшня <span id="stableTimer"></span></button>
            <button onclick="showBarracks()">🛡️ Казарми <span id="barracksTimer"></span></button>
            <button onclick="showRange()">🏹 Стрільбище <span id="rangeTimer"></span></button>
            <button onclick="showTemple()">⛪ Храм <span id="templeTimer"></span></button>
            <button onclick="showBakery()">🍞 Пекарня <span id="bakeryTimer"></span></button>
            <button onclick="showWorkshop()">🧵 Майстерня <span id="workshopTimer"></span></button>
            <button onclick="showHospital()">🏥 Лікарня <span id="hospitalTimer"></span></button>
            <button onclick="showCapital()">⬅️ НАЗАД</button>
        </div>`;
    updateBuildingTimer();
}

function showBuildingMenu(title, resources, time, type, seconds) {
    let html = resources.map(x => `<p>${x}</p>`).join("");
    document.getElementById("game").innerHTML = `
        <h1>${title}</h1>
        ${html}
        <hr>
        <p>⏱️ Час будівництва: ${time}</p>
        <div class="menu">
            <button onclick="startBuilding('${type}', ${seconds})">🔨 ПОБУДУВАТИ</button>
            <button onclick="showConstruction()">⬅️ НАЗАД</button>
        </div>`;
}

function showHouse(){showBuildingMenu("🏠 Будинки",["🪵 Дерево: 15","🪨 Камінь: 10","🧱 Цегла: 10"],"5 хв","house",300);}
function showSmithy(){showBuildingMenu("⚒️ Кузня",["🪵 Дерево: 10","🪨 Камінь: 15","⛓️ Залізо: 5","🏺 Глина: 5"],"20 хв","smithy",1200);}
function showFarm(){showBuildingMenu("🌾 Ферма",["🪵 Дерево: 5","🪨 Камінь: 10","🌾 Солома: 25"],"15 хв","farm",900);}
function showStable(){showBuildingMenu("🐴 Конюшня",["🪵 Дерево: 30","🪨 Камінь: 50","🌾 Солома: 25","⛓️ Залізо: 10","🏺 Глина: 10","🧱 Цегла: 20"],"40 хв","stable",2400);}
function showBarracks(){showBuildingMenu("🛡️ Казарми",["🪵 Дерево: 25","🪨 Камінь: 30","⛓️ Залізо: 15"],"30 хв","barracks",1800);}
function showRange(){showBuildingMenu("🏹 Стрільбище",["🪵 Дерево: 20","🪨 Камінь: 20","⛓️ Залізо: 10"],"25 хв","range",1500);}
function showTemple(){showBuildingMenu("⛪ Храм",["🪵 Дерево: 20","🪨 Камінь: 35","🧱 Цегла: 20"],"35 хв","temple",2100);}
function showBakery(){showBuildingMenu("🍞 Пекарня",["🪵 Дерево: 15","🪨 Камінь: 15","🧱 Цегла: 15","🏺 Глина: 5"],"20 хв","bakery",1200);}
function showWorkshop(){showBuildingMenu("🧵 Майстерня",["🪵 Дерево: 20","🪨 Камінь: 15","⛓️ Залізо: 10"],"25 хв","workshop",1500);}
function showHospital(){showBuildingMenu("🏥 Лікарня",["🪵 Дерево: 25","🪨 Камінь: 30","🧱 Цегла: 20"],"40 хв","hospital",2400);}

function startBuilding(type, seconds) {
    if (building) return;
    building = true;
    currentBuilding = type;
    buildingTime = seconds;
    showConstruction();
    updateBuildingTimer();

    buildingTimerInterval = setInterval(() => {
        buildingTime--;
        updateBuildingTimer();

        if (buildingTime <= 0) {
            clearInterval(buildingTimerInterval);
            buildingTimerInterval = null;
            if (currentBuilding === "house") houses++;
            building = false;
            currentBuilding = "";
            showConstruction();
        }
    }, 1000);
}

function updateBuildingTimer() {
    if (!building) return;
    const timer = document.getElementById(currentBuilding + "Timer");
    if (!timer) return;
    const minutes = Math.floor(buildingTime / 60);
    const seconds = buildingTime % 60;
    timer.textContent = ` ⏱️ ${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
}

function showWarehouse(){
    document.getElementById("game").innerHTML=`<h1>📦 Склад</h1><p>🪨 Камінь: 0</p><p>🪵 Дерево: 0</p><p>⛓️ Залізо: 0</p><p>🌾 Солома: 0</p><p>🧱 Цегла: 0</p><p>🏺 Глина: 0</p><p>🏖️ Пісок: 0</p><hr><p>🍞 Хліб: 0</p><p>🥩 М'ясо: 0</p><p>🌾 Борошно: 0</p><p>🥕 Морква: 0</p><p>🥔 Картопля: 0</p><p>💧 Вода: 0</p><p>🍎 Яблука: 0</p><button onclick="showKingdom()">⬅️ Назад</button>`;
}

function showArmy(){
    document.getElementById("game").innerHTML=`<h1>⚔️ Армія</h1><p>🗡️ Мечники: 0</p><p>🏹 Лучники: 0</p><p>🛡️ Щитоносці: 0</p><p>🐎 Легка кіннота: 0</p><p>🛡️ Лицарі: 0</p><hr><p>💪 Військова сила: 0</p><button onclick="showKingdom()">⬅️ Назад</button>`;
}

function showVillages(){
    document.getElementById("game").innerHTML=`<h1>🏠 Села</h1><p>🏠 Сіл: 0</p><button onclick="showKingdom()">⬅️ Назад</button>`;
}

function showTreasury(){
    document.getElementById("game").innerHTML=`<h1>💰 Казна</h1><p>💰 Золото: 0</p><button onclick="showKingdom()">⬅️ Назад</button>`;
}

function showPopulation(){
    document.getElementById("game").innerHTML=`<h1>👥 Населення</h1><p>👥 Населення: 0</p><button onclick="showKingdom()">⬅️ Назад</button>`;
}

window.addEventListener("load", function(){
    if(localStorage.getItem("registered")==="true"){
        openGame();
    }else{
        document.getElementById("registration").style.display="block";
        document.getElementById("game").style.display="none";
    }
});
