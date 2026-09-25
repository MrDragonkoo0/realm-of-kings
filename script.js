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
