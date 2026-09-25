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

        <button onclick="showCities()">⬅️ Назад</button>
    `;
}

function showKingdom() {
    location.reload();
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
