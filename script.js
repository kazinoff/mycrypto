// ПОКРАЩЕНИЙ Gist менеджер для синхронізації з діагностикою
class GistManager {
    constructor(token) {
        this.token = token;
        this.gistId = localStorage.getItem('portfolioGistId');
        this.debug = true;
    }

    log(message) {
        if (this.debug) {
            console.log('🔧 GistManager:', message);
        }
    }

    // Знайти існуючий Gist за описом
    async findExistingGist() {
        try {
            this.log('Пошук існуючого Gist...');
            const response = await fetch('https://api.github.com/gists', {
                headers: {
                    'Authorization': `token ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const gists = await response.json();
            const existingGist = gists.find(gist => 
                gist.description === "Crypto Portfolio Data" && 
                gist.files && 
                gist.files["portfolio.json"]
            );
            
            if (existingGist) {
                this.log(`Знайдено Gist: ${existingGist.id}`);
            } else {
                this.log('Gist не знайдено');
            }
            
            return existingGist;
        } catch (error) {
            console.error('Помилка пошуку Gist:', error);
            return null;
        }
    }

    // Створити новий Gist
    async createGist(portfolioData) {
        try {
            this.log('Створення нового Gist...');
            const response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: "Crypto Portfolio Data",
                    public: false,
                    files: {
                        "portfolio.json": {
                            content: JSON.stringify(portfolioData, null, 2)
                        }
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const gist = await response.json();
            this.gistId = gist.id;
            localStorage.setItem('portfolioGistId', gist.id);
            this.log(`Gist створено: ${gist.id}`);
            return gist;
        } catch (error) {
            console.error('Помилка створення Gist:', error);
            throw error;
        }
    }

    // Оновити Gist
    async updateGist(portfolioData) {
        try {
            // Спочатку шукаємо існуючий Gist
            if (!this.gistId) {
                this.log('Gist ID не знайдено, шукаємо існуючий...');
                const existingGist = await this.findExistingGist();
                if (existingGist) {
                    this.gistId = existingGist.id;
                    localStorage.setItem('portfolioGistId', this.gistId);
                    this.log(`Використовуємо знайдений Gist: ${this.gistId}`);
                } else {
                    this.log('Gist не знайдено, створюємо новий...');
                    return await this.createGist(portfolioData);
                }
            }

            this.log(`Оновлення Gist: ${this.gistId}`);
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: "Crypto Portfolio Data",
                    files: {
                        "portfolio.json": {
                            content: JSON.stringify(portfolioData, null, 2)
                        }
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            this.log('Gist успішно оновлено');
            return result;
        } catch (error) {
            console.error('Помилка оновлення Gist:', error);
            throw error;
        }
    }

    // Завантажити з Gist
    async loadGist() {
        try {
            // Спочатку шукаємо існуючий Gist
            if (!this.gistId) {
                this.log('Gist ID не знайдено, шукаємо існуючий...');
                const existingGist = await this.findExistingGist();
                if (existingGist) {
                    this.gistId = existingGist.id;
                    localStorage.setItem('portfolioGistId', this.gistId);
                    this.log(`Використовуємо знайдений Gist: ${this.gistId}`);
                } else {
                    this.log('Gist не знайдено');
                    return null;
                }
            }

            this.log(`Завантаження Gist: ${this.gistId}`);
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                headers: {
                    'Authorization': `token ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const gist = await response.json();
            
            if (!gist.files || !gist.files['portfolio.json']) {
                throw new Error('Файл portfolio.json не знайдено в Gist');
            }

            const content = gist.files['portfolio.json'].content;
            const data = JSON.parse(content);
            this.log('Gist успішно завантажено');
            return data;
        } catch (error) {
            console.error('Помилка завантаження Gist:', error);
            throw error;
        }
    }
}

// Глобальні змінні для синхронізації
let gistManager = null;

// Зберігання поточних курсів для кожної валюти
let currentRates = {};

// Назва поточного файлу
let currentFileName = "portfolio_data";

// Функції для роботи з високою точністю
const PRECISION_FACTOR = 1000000;

function toMicroUnits(value) {
    return Math.round(value * PRECISION_FACTOR);
}

function fromMicroUnits(microValue) {
    return microValue / PRECISION_FACTOR;
}

function preciseRound(number, decimals = 6) {
    if (number === 0 || number === null || number === undefined) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round(number * factor) / factor;
}

function formatNumber(number, decimals = 6) {
    if (number === 0 || number === null || number === undefined) return '0';
    
    let rounded = preciseRound(number, decimals);
    let formatted = parseFloat(rounded.toFixed(decimals)).toString();
    
    if (formatted.indexOf('.') === -1 && decimals > 0) {
        formatted += '.0';
    }
    
    return formatted;
}

function floatEquals(a, b, tolerance = 1e-10) {
    return Math.abs(a - b) < tolerance;
}

function floatLessOrEqual(a, b, tolerance = 1e-10) {
    return a <= b || floatEquals(a, b, tolerance);
}

// ПОКРАЩЕНА СИНХРОНІЗАЦІЯ З ДІАГНОСТИКОЮ
function setupSync() {
    const tokenInput = document.getElementById('github-token');
    const token = tokenInput.value.trim();
    
    if (!token) {
        alert('Будь ласка, введіть GitHub Personal Access Token');
        return;
    }
    
    try {
        console.log('🔄 Налаштування синхронізації...');
        gistManager = new GistManager(token);
        localStorage.setItem('githubToken', token);
        
        document.getElementById('token-input').style.display = 'none';
        document.getElementById('sync-controls').style.display = 'flex';
        document.getElementById('sync-status').textContent = 'Синхронізація налаштована!';
        
        // Автоматично завантажуємо дані при налаштуванні
        setTimeout(() => {
            console.log('🔄 Автоматичне завантаження даних...');
            loadFromGist();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Помилка налаштування синхронізації:', error);
        alert('Помилка налаштування синхронізації: ' + error.message);
    }
}

async function saveToGist() {
    if (!gistManager) {
        console.warn('⚠️ GistManager не налаштовано');
        alert('Спочатку налаштуйте синхронізацію');
        return;
    }
    
    try {
        console.log('💾 Спроба зберегти дані в Gist...');
        document.getElementById('sync-status').textContent = '⏳ Збереження...';
        
        const portfolioData = {
            transactions: transactions,
            currentRates: currentRates,
            fileName: currentFileName,
            lastSync: new Date().toISOString(),
            syncVersion: "2.0",
            device: navigator.userAgent
        };
        
        console.log('📊 Дані для збереження:', portfolioData);
        
        await gistManager.updateGist(portfolioData);
        document.getElementById('sync-status').textContent = '✅ Збережено: ' + new Date().toLocaleTimeString();
        console.log('✅ Дані успішно збережено в Gist');
        
    } catch (error) {
        document.getElementById('sync-status').textContent = '❌ Помилка збереження';
        console.error('❌ Помилка збереження в Gist:', error);
        alert('Помилка збереження в хмару: ' + error.message);
    }
}

async function loadFromGist() {
    if (!gistManager) {
        console.warn('⚠️ GistManager не налаштовано');
        alert('Спочатку налаштуйте синхронізацію');
        return;
    }
    
    try {
        console.log('🔄 Спроба завантажити дані з Gist...');
        document.getElementById('sync-status').textContent = '⏳ Завантаження...';
        
        const remoteData = await gistManager.loadGist();
        if (remoteData) {
            console.log('📥 Отримані дані з Gist:', remoteData);
            
            if (confirm('Завантажити дані з хмару? Поточні дані будуть замінені.')) {
                if (remoteData.transactions && Array.isArray(remoteData.transactions)) {
                    transactions = remoteData.transactions;
                    saveTransactions();
                    console.log('✅ Транзакції завантажено:', transactions.length);
                }
                
                if (remoteData.currentRates) {
                    currentRates = remoteData.currentRates;
                    saveCurrentRates();
                    console.log('✅ Курси завантажено:', Object.keys(currentRates).length);
                }
                
                if (remoteData.fileName) {
                    currentFileName = remoteData.fileName;
                }
                
                updateTransactionsTable();
                updatePortfolio();
                updateReport();
                updateFileNameDisplay();
                
                document.getElementById('sync-status').textContent = '✅ Завантажено: ' + new Date().toLocaleTimeString();
                console.log('✅ Всі дані успішно завантажено');
            }
        } else {
            document.getElementById('sync-status').textContent = 'ℹ️ Немає даних в хмарі. Спочатку збережіть дані.';
            console.log('ℹ️ Gist порожній');
        }
    } catch (error) {
        document.getElementById('sync-status').textContent = '❌ Помилка завантаження';
        console.error('❌ Помилка завантаження з Gist:', error);
        alert('Помилка завантаження з хмару: ' + error.message);
    }
}

// Автоматична перевірка збереженого токена
function checkSavedToken() {
    const savedToken = localStorage.getItem('githubToken');
    if (savedToken) {
        console.log('🔑 Знайдено збережений токен');
        gistManager = new GistManager(savedToken);
        document.getElementById('token-input').style.display = 'none';
        document.getElementById('sync-controls').style.display = 'flex';
        document.getElementById('sync-status').textContent = 'Синхронізація активна';
        
        // Автоматично завантажуємо дані при завантаженні сторінки
        setTimeout(() => {
            console.log('🔄 Автоматичне завантаження даних при старті...');
            loadFromGist();
        }, 2000);
    } else {
        console.log('🔑 Збережений токен не знайдено');
    }
}

// Додамо функцію для перевірки стану синхронізації
function checkSyncStatus() {
    if (!gistManager) {
        return 'Синхронізація не налаштована';
    }
    
    const gistId = localStorage.getItem('portfolioGistId');
    const token = localStorage.getItem('githubToken');
    
    return `Gist ID: ${gistId || 'не встановлено'}, Token: ${token ? 'наявний' : 'відсутній'}`;
}

// Додамо кнопку для діагностики
function addDebugInfo() {
    const debugInfo = document.createElement('div');
    debugInfo.style.marginTop = '10px';
    debugInfo.style.padding = '10px';
    debugInfo.style.background = '#f0f0f0';
    debugInfo.style.borderRadius = '5px';
    debugInfo.style.fontSize = '12px';
    debugInfo.innerHTML = `
        <button onclick="showDebugInfo()" style="margin-bottom: 5px;">🛠️ Діагностика</button>
        <div id="debug-output" style="display: none;"></div>
    `;
    
    const syncSection = document.querySelector('.sync-section');
    syncSection.appendChild(debugInfo);
}

function showDebugInfo() {
    const debugOutput = document.getElementById('debug-output');
    const info = `
        <div><strong>Стаття синхронізації:</strong></div>
        <div>Gist ID: ${localStorage.getItem('portfolioGistId') || 'не встановлено'}</div>
        <div>Token: ${localStorage.getItem('githubToken') ? 'наявний' : 'відсутній'}</div>
        <div>Транзакції: ${transactions.length}</div>
        <div>Курси: ${Object.keys(currentRates).length}</div>
        <div>GistManager: ${gistManager ? 'ініціалізований' : 'не ініціалізований'}</div>
        <button onclick="forceSync()" style="margin-top: 5px;">🔄 Примусова синхронізація</button>
    `;
    
    debugOutput.innerHTML = info;
    debugOutput.style.display = 'block';
}

function forceSync() {
    console.log('🔧 Примусова синхронізація...');
    saveToGist();
}

// ДОДАЄМО АВТОМАТИЧНУ СИНХРОНІЗАЦІЮ ПІСЛЯ КОЖНОЇ ЗМІНИ
function withAutoSync(originalFunction) {
    return function(...args) {
        const result = originalFunction.apply(this, args);
        
        // Автоматично синхронізуємо через 1 секунду після зміни
        if (gistManager) {
            setTimeout(() => {
                console.log('🔄 Автоматична синхронізація після зміни...');
                saveToGist();
            }, 1000);
        }
        
        return result;
    };
}

// Решта твого оригінального коду залишається без змін...
let transactions = [];

function loadTransactions() {
    const storedTransactions = localStorage.getItem('cryptoTransactions');
    if (storedTransactions) {
        transactions = JSON.parse(storedTransactions);
        console.log(`📊 Завантажено ${transactions.length} транзакцій`);
    }
}

function loadCurrentRates() {
    const storedRates = localStorage.getItem('cryptoCurrentRates');
    if (storedRates) {
        currentRates = JSON.parse(storedRates);
        console.log(`📊 Завантажено ${Object.keys(currentRates).length} курсів`);
    }
}

function saveCurrentRates() {
    localStorage.setItem('cryptoCurrentRates', JSON.stringify(currentRates));
    console.log('💾 Курси збережено локально');
}

function saveTransactions() {
    localStorage.setItem('cryptoTransactions', JSON.stringify(transactions));
    console.log('💾 Транзакції збережено локально');
}

// Ініціалізація додатку
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Запуск додатку...');
    
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
    
    initForm();
    loadTransactions();
    loadCurrentRates();
    checkSavedToken();
    addDebugInfo(); // Додаємо діагностику
    updateTransactionsTable();
    updateFileNameDisplay();
    document.getElementById('importFile').addEventListener('change', handleFileImport);
    
    console.log('✅ Додаток ініціалізовано');
});

// Огортаємо основні функції для автоматичної синхронізації
const originalAddTransaction = addTransaction;
addTransaction = withAutoSync(originalAddTransaction);

const originalDeleteTransaction = deleteTransaction;
deleteTransaction = withAutoSync(originalDeleteTransaction);

const originalUpdateCurrentRate = updateCurrentRate;
updateCurrentRate = withAutoSync(originalUpdateCurrentRate);

const originalClearCurrentRate = clearCurrentRate;
clearCurrentRate = withAutoSync(originalClearCurrentRate);

// Решта твоїх функцій залишається без змін...
function switchTab(tabName) {
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => {
        tab.classList.remove('active');
    });
    
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
    
    if (tabName === 'portfolio') {
        updatePortfolio();
    } else if (tabName === 'report') {
        updateReport();
    } else if (tabName === 'journal') {
        updateTransactionsTable();
    }
}

function initForm() {
    // Твій оригінальний код ініціалізації форми
    const typeButtons = document.querySelectorAll('.type-btn');
    const submitButton = document.getElementById('submit-btn');
    const buyAmountGroup = document.getElementById('buy-amount-group');
    const sellQuantityGroup = document.getElementById('sell-quantity-group');
    const calculatedAmountGroup = document.getElementById('calculated-amount-group');
    const amountInput = document.getElementById('amount');
    const priceInput = document.getElementById('price');
    const quantityInput = document.getElementById('quantity');
    const calculatedAmountInput = document.getElementById('calculated-amount');
    const currencySelect = document.getElementById('currency');
    const availableQuantityDiv = document.getElementById('available-quantity');
    const transactionForm = document.getElementById('transaction-form');
    const maxBtn = document.getElementById('max-btn');
    const quantityError = document.getElementById('quantity-error');
    
    currencySelect.addEventListener('change', updateAvailableQuantity);
    
    maxBtn.addEventListener('click', function() {
        const currencyGroups = calculateCurrencyGroups();
        const selectedCurrency = currencySelect.value;
        
        if (!selectedCurrency) {
            alert('Спочатку оберіть криптовалюту');
            return;
        }
        
        const available = (currencyGroups[selectedCurrency] || { netQuantity: 0 }).netQuantity;
        quantityInput.value = preciseRound(available, 6);
        calculateSellAmount();
        quantityError.style.display = 'none';
        quantityInput.classList.remove('input-error');
    });
    
    quantityInput.addEventListener('input', function() {
        const currencyGroups = calculateCurrencyGroups();
        const selectedCurrency = currencySelect.value;
        
        if (!selectedCurrency) return;
        
        const available = (currencyGroups[selectedCurrency] || { netQuantity: 0 }).netQuantity;
        const enteredQuantity = parseFloat(quantityInput.value) || 0;
        
        if (!floatLessOrEqual(enteredQuantity, available)) {
            quantityError.style.display = 'block';
            quantityInput.classList.add('input-error');
        } else {
            quantityError.style.display = 'none';
            quantityInput.classList.remove('input-error');
        }
        
        calculateSellAmount();
    });
    
    typeButtons.forEach(button => {
        button.addEventListener('click', function() {
            typeButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            const type = this.getAttribute('data-type');
            if (type === 'buy') {
                submitButton.textContent = 'Додати операцію купівлі';
                submitButton.style.backgroundColor = 'var(--buy-color)';
                buyAmountGroup.style.display = 'block';
                amountInput.required = true;
                sellQuantityGroup.style.display = 'none';
                quantityInput.required = false;
                calculatedAmountGroup.style.display = 'none';
                quantityError.style.display = 'none';
                quantityInput.classList.remove('input-error');
            } else {
                submitButton.textContent = 'Додати операцію продажу';
                submitButton.style.backgroundColor = 'var(--sell-color)';
                buyAmountGroup.style.display = 'none';
                amountInput.required = false;
                sellQuantityGroup.style.display = 'block';
                quantityInput.required = true;
                calculatedAmountGroup.style.display = 'block';
                updateAvailableQuantity();
            }
        });
    });
    
    amountInput.addEventListener('input', function() {
        if (document.querySelector('.type-buy').classList.contains('active')) {
            calculateBuyQuantity();
        }
    });
    
    priceInput.addEventListener('input', function() {
        if (document.querySelector('.type-buy').classList.contains('active')) {
            calculateBuyQuantity();
        } else {
            calculateSellAmount();
        }
    });
    
    quantityInput.addEventListener('input', calculateSellAmount);
    
    transactionForm.addEventListener('submit', function(e) {
        e.preventDefault();
        addTransaction();
    });
}

function calculateBuyQuantity() {
    // Логіка залишається незмінною
}

function calculateSellAmount() {
    const quantityInput = document.getElementById('quantity');
    const priceInput = document.getElementById('price');
    const calculatedAmountInput = document.getElementById('calculated-amount');
    
    const quantity = parseFloat(quantityInput.value);
    const price = parseFloat(priceInput.value);
    
    if (quantity && price && price > 0) {
        const amount = quantity * price;
        calculatedAmountInput.value = preciseRound(amount, 2);
    } else {
        calculatedAmountInput.value = '';
    }
}

function updateAvailableQuantity() {
    const currencySelect = document.getElementById('currency');
    const availableQuantityDiv = document.getElementById('available-quantity');
    const selectedCurrency = currencySelect.value;
    const quantityError = document.getElementById('quantity-error');
    
    if (!selectedCurrency) {
        availableQuantityDiv.textContent = 'Доступно: 0';
        return;
    }
    
    const currencyGroups = calculateCurrencyGroups();
    const available = (currencyGroups[selectedCurrency] || { netQuantity: 0 }).netQuantity;
    availableQuantityDiv.textContent = `Доступно: ${formatNumber(available, 6)}`;
    
    const quantityInput = document.getElementById('quantity');
    quantityInput.max = available;
    
    const currentQuantity = parseFloat(quantityInput.value) || 0;
    
    if (!floatLessOrEqual(currentQuantity, available)) {
        quantityError.style.display = 'block';
        quantityInput.classList.add('input-error');
    } else {
        quantityError.style.display = 'none';
        quantityInput.classList.remove('input-error');
    }
}

function addTransaction() {
    const date = document.getElementById('date').value;
    const currency = document.getElementById('currency').value;
    const price = parseFloat(document.getElementById('price').value);
    const type = document.querySelector('.type-btn.active').getAttribute('data-type');
    const quantityError = document.getElementById('quantity-error');
    
    let amount, quantity;
    
    if (type === 'buy') {
        amount = parseFloat(document.getElementById('amount').value);
        quantity = amount / price;
    } else {
        quantity = parseFloat(document.getElementById('quantity').value);
        amount = quantity * price;
        
        const currencyGroups = calculateCurrencyGroups();
        const available = (currencyGroups[currency] || { netQuantity: 0 }).netQuantity;
        
        if (!floatLessOrEqual(quantity, available)) {
            quantityError.style.display = 'block';
            document.getElementById('quantity').classList.add('input-error');
            return;
        }
    }
    
    if (!date || !currency || !price || (type === 'buy' && !amount) || (type === 'sell' && !quantity)) {
        alert('Будь ласка, заповніть всі обов\'язкові поля');
        return;
    }
    
    const transaction = {
        id: Date.now(),
        date,
        type,
        currency,
        price: preciseRound(price, 6),
        amount: preciseRound(amount, 6),
        quantity: preciseRound(quantity, 8)
    };
    
    transactions.push(transaction);
    saveTransactions();
    document.getElementById('transaction-form').reset();
    document.getElementById('calculated-amount').value = '';
    updateTransactionsTable();
    switchTab('portfolio');
    
    return transaction; // Важливо для auto-sync
}

function deleteTransaction(id) {
    if (confirm('Ви впевнені, що хочете видалити цю операцію?')) {
        transactions = transactions.filter(transaction => transaction.id !== id);
        saveTransactions();
        updateTransactionsTable();
        updatePortfolio();
        updateReport();
        
        return true; // Важливо для auto-sync
    }
    return false;
}

function updateTransactionsTable() {
    const tbody = document.getElementById('transactions-body');
    tbody.innerHTML = '';
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Немає операцій</td></tr>';
        return;
    }
    
    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedTransactions.forEach(transaction => {
        const row = document.createElement('tr');
        row.className = `transaction-${transaction.type}`;
        
        row.innerHTML = `
            <td>${transaction.date}</td>
            <td><span class="${transaction.type === 'buy' ? 'positive' : 'negative'}">${transaction.type === 'buy' ? 'Купівля' : 'Продаж'}</span></td>
            <td>${transaction.currency}</td>
            <td class="number-cell">${formatNumber(transaction.amount, 2)} USDT</td>
            <td class="number-cell">${formatNumber(transaction.price, 4)}</td>
            <td class="number-cell">${formatNumber(transaction.quantity, 6)}</td>
            <td><button class="delete-btn" onclick="deleteTransaction(${transaction.id})">Видалити</button></td>
        `;
        
        tbody.appendChild(row);
    });
}

// ... (решта функцій calculateCurrencyGroups, updatePortfolio, updateReport, etc.) ...

// Додамо також автоматичну синхронізацію при закритті сторінки
window.addEventListener('beforeunload', function() {
    if (gistManager && transactions.length > 0) {
        console.log('💾 Автоматичне збереження перед закриттям...');
        // Використовуємо синхронний запит для надійності
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.github.com/gists/' + localStorage.getItem('portfolioGistId'), false);
        xhr.setRequestHeader('Authorization', 'token ' + localStorage.getItem('githubToken'));
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        const portfolioData = {
            transactions: transactions,
            currentRates: currentRates,
            fileName: currentFileName,
            lastSync: new Date().toISOString()
        };
        
        xhr.send(JSON.stringify({
            files: {
                "portfolio.json": {
                    content: JSON.stringify(portfolioData, null, 2)
                }
            }
        }));
    }
});
