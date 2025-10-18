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

// Глобальні змінні
let gistManager = null;
let transactions = [];
let currentRates = {};
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

// СИНХРОНІЗАЦІЯ
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
            syncVersion: "2.0"
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

// ДІАГНОСТИКА
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
    if (syncSection) {
        syncSection.appendChild(debugInfo);
    }
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

// ОСНОВНІ ФУНКЦІЇ ДОДАТКУ
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

function checkSavedToken() {
    const savedToken = localStorage.getItem('githubToken');
    if (savedToken) {
        console.log('🔑 Знайдено збережений токен');
        gistManager = new GistManager(savedToken);
        document.getElementById('token-input').style.display = 'none';
        document.getElementById('sync-controls').style.display = 'flex';
        document.getElementById('sync-status').textContent = 'Синхронізація активна';
        
        setTimeout(() => {
            console.log('🔄 Автоматичне завантаження даних при старті...');
            loadFromGist();
        }, 2000);
    } else {
        console.log('🔑 Збережений токен не знайдено');
    }
}

// ФУНКЦІЇ ДЛЯ РОБОТИ З ФОРМОЮ
function initForm() {
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
    
    if (!currencySelect || !transactionForm) return;
    
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
    
    // Автоматично синхронізуємо після додавання транзакції
    if (gistManager) {
        setTimeout(() => saveToGist(), 1000);
    }
    
    return transaction;
}

function deleteTransaction(id) {
    if (confirm('Ви впевнені, що хочете видалити цю операцію?')) {
        transactions = transactions.filter(transaction => transaction.id !== id);
        saveTransactions();
        updateTransactionsTable();
        updatePortfolio();
        updateReport();
        
        // Автоматично синхронізуємо після видалення транзакції
        if (gistManager) {
            setTimeout(() => saveToGist(), 1000);
        }
        
        return true;
    }
    return false;
}

function updateTransactionsTable() {
    const tbody = document.getElementById('transactions-body');
    if (!tbody) return;
    
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

function calculateCurrencyGroups() {
    const groups = {};
    
    const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    sortedTransactions.forEach(transaction => {
        const currency = transaction.currency;
        
        if (!groups[currency]) {
            groups[currency] = {
                currency,
                totalInvested: 0,
                totalQuantity: 0,
                netQuantity: 0,
                totalCost: 0,
                realizedPnL: 0,
                totalSold: 0,
                avgPrice: 0,
                buyTransactions: []
            };
        }
        
        const group = groups[currency];
        
        if (transaction.type === 'buy') {
            group.buyTransactions.push({
                quantity: transaction.quantity,
                price: transaction.price,
                amount: transaction.amount
            });
            
            group.totalInvested += transaction.amount;
            group.totalQuantity += transaction.quantity;
            group.netQuantity += transaction.quantity;
            group.totalCost += transaction.amount;
            
            group.avgPrice = group.totalCost / group.totalQuantity;
        } else {
            let remainingQuantity = transaction.quantity;
            let soldCost = 0;
            
            while (remainingQuantity > 0 && group.buyTransactions.length > 0) {
                const firstBuy = group.buyTransactions[0];
                
                if (firstBuy.quantity <= remainingQuantity) {
                    soldCost += firstBuy.amount;
                    remainingQuantity -= firstBuy.quantity;
                    group.buyTransactions.shift();
                } else {
                    const fraction = remainingQuantity / firstBuy.quantity;
                    soldCost += firstBuy.amount * fraction;
                    firstBuy.quantity -= remainingQuantity;
                    firstBuy.amount = firstBuy.quantity * firstBuy.price;
                    remainingQuantity = 0;
                }
            }
            
            const realizedPnL = transaction.amount - soldCost;
            
            group.realizedPnL += realizedPnL;
            group.totalSold += transaction.amount;
            group.netQuantity -= transaction.quantity;
            
            group.totalCost = group.buyTransactions.reduce((sum, buy) => sum + buy.amount, 0);
            group.totalQuantity = group.buyTransactions.reduce((sum, buy) => sum + buy.quantity, 0);
            group.avgPrice = group.totalQuantity > 0 ? group.totalCost / group.totalQuantity : 0;
        }
    });
    
    Object.values(groups).forEach(group => {
        delete group.buyTransactions;
    });
    
    return groups;
}

// ФУНКЦІЇ ДЛЯ ОНОВЛЕННЯ ІНТЕРФЕЙСУ
function updatePortfolio() {
    const portfolioGrid = document.getElementById('portfolio-grid');
    if (!portfolioGrid) return;
    
    portfolioGrid.innerHTML = '';
    
    const currencyGroups = calculateCurrencyGroups();
    let totalPortfolioValue = 0;
    let totalRealizedPnL = 0;
    let totalUnrealizedPnL = 0;
    
    const allCurrencies = [...new Set(transactions.map(t => t.currency))];
    
    allCurrencies.forEach(currency => {
        const group = currencyGroups[currency] || {
            currency,
            totalInvested: 0,
            totalQuantity: 0,
            netQuantity: 0,
            totalCost: 0,
            realizedPnL: 0,
            totalSold: 0,
            avgPrice: 0
        };
        
        totalRealizedPnL += group.realizedPnL;
        
        const currentRate = currentRates[currency] || 0;
        const currentValue = group.netQuantity * currentRate;
        const unrealizedPnL = currentValue - group.totalCost;
        
        totalUnrealizedPnL += unrealizedPnL;
        totalPortfolioValue += currentValue;
    });
    
    // Оновлюємо загальні показники
    const totalValueElem = document.getElementById('total-value');
    const realizedPnlElem = document.getElementById('realized-pnl');
    const unrealizedPnlElem = document.getElementById('unrealized-pnl');
    const portfolioTotalElem = document.getElementById('portfolio-total-value');
    
    if (totalValueElem) totalValueElem.textContent = `${formatNumber(totalPortfolioValue, 2)} USDT`;
    if (realizedPnlElem) realizedPnlElem.textContent = `${formatNumber(totalRealizedPnL, 2)} USDT`;
    if (unrealizedPnlElem) unrealizedPnlElem.textContent = `${formatNumber(totalUnrealizedPnL, 2)} USDT`;
    if (portfolioTotalElem) portfolioTotalElem.textContent = `${formatNumber(totalPortfolioValue, 2)} USDT`;
    
    // Створюємо картки для кожної валюти
    allCurrencies.forEach(currency => {
        const group = currencyGroups[currency] || {
            currency,
            totalInvested: 0,
            totalQuantity: 0,
            netQuantity: 0,
            totalCost: 0,
            realizedPnL: 0,
            totalSold: 0,
            avgPrice: 0
        };
        
        const currentRate = currentRates[currency] || 0;
        const currentValue = group.netQuantity * currentRate;
        const unrealizedPnL = currentValue - group.totalCost;
        const unrealizedPnLPercent = group.totalCost > 0 ? (unrealizedPnL / group.totalCost) * 100 : 0;
        
        const card = document.createElement('div');
        card.className = 'portfolio-card';
        
        if (group.netQuantity <= 0) {
            card.classList.add('zero-balance');
        }
        
        card.innerHTML = `
            <h3>
                <span class="crypto-icon">${getCurrencyIcon(currency)}</span>
                ${currency}
                ${group.netQuantity <= 0 ? '<span style="font-size: 0.8rem; color: #999; margin-left: 10px;">(продано)</span>' : ''}
            </h3>
            <div class="portfolio-value">${formatNumber(currentValue, 2)} USDT</div>
            <div class="portfolio-details">
                <div class="portfolio-detail-item">
                    <span>Кількість:</span>
                    <span class="number-cell">${formatNumber(group.netQuantity, 6)}</span>
                </div>
                <div class="portfolio-detail-item">
                    <span>Середня ціна:</span>
                    <span class="number-cell">${formatNumber(group.avgPrice, 4)} USDT</span>
                </div>
                <div class="portfolio-detail-item">
                    <span>Поточна ціна:</span>
                    <div class="rate-controls">
                        <input type="number" class="current-rate-input" id="rate-${currency}" 
                            value="${currentRate}" step="0.0001" min="0" 
                            placeholder="Введіть курс" onchange="updateCurrentRate('${currency}', this.value)">
                        <button class="clear-rate-btn" onclick="clearCurrentRate('${currency}')">Очистити</button>
                    </div>
                </div>
                <div class="portfolio-detail-item">
                    <span>Інвестовано:</span>
                    <span class="number-cell">${formatNumber(group.totalInvested, 2)} USDT</span>
                </div>
                ${group.netQuantity > 0 ? `
                <div class="portfolio-detail-item">
                    <span>Нереалізований PnL:</span>
                    <span class="number-cell ${unrealizedPnL >= 0 ? 'positive' : 'negative'}">
                        ${formatNumber(unrealizedPnL, 2)} USDT (${formatNumber(unrealizedPnLPercent, 2)}%)
                    </span>
                </div>
                ` : ''}
                <div class="portfolio-detail-item">
                    <span>Реалізований PnL:</span>
                    <span class="number-cell ${group.realizedPnL >= 0 ? 'positive' : 'negative'}">
                        ${formatNumber(group.realizedPnL, 2)} USDT
                    </span>
                </div>
            </div>
        `;
        
        portfolioGrid.appendChild(card);
    });
    
    if (portfolioGrid.children.length === 0) {
        portfolioGrid.innerHTML = '<p>Портфель порожній. Додайте першу операцію купівлі.</p>';
    }
}

function updateReport() {
    const currencyGroups = calculateCurrencyGroups();
    let totalInvestment = 0;
    let totalSales = 0;
    let totalPortfolioValue = 0;
    let totalRealizedPnL = 0;
    let totalUnrealizedPnL = 0;
    
    const allCurrencies = [...new Set(transactions.map(t => t.currency))];
    
    allCurrencies.forEach(currency => {
        const group = currencyGroups[currency] || {
            currency,
            totalInvested: 0,
            totalQuantity: 0,
            netQuantity: 0,
            totalCost: 0,
            realizedPnL: 0,
            totalSold: 0
        };
        
        totalInvestment += group.totalInvested;
        totalRealizedPnL += group.realizedPnL;
        
        const currentRate = currentRates[currency] || 0;
        const currentValue = group.netQuantity * currentRate;
        const unrealizedPnL = currentValue - group.totalCost;
        
        totalUnrealizedPnL += unrealizedPnL;
        totalPortfolioValue += currentValue;
    });
    
    transactions.forEach(transaction => {
        if (transaction.type === 'sell') {
            totalSales += transaction.amount;
        }
    });
    
    // Оновлюємо загальні показники
    const totalInvestmentElem = document.getElementById('total-investment');
    const totalSalesElem = document.getElementById('total-sales');
    const totalPortfolioValueElem = document.getElementById('total-portfolio-value');
    const totalResultElem = document.getElementById('total-result');
    
    if (totalInvestmentElem) totalInvestmentElem.textContent = `${formatNumber(totalInvestment, 2)} USDT`;
    if (totalSalesElem) totalSalesElem.textContent = `${formatNumber(totalSales, 2)} USDT`;
    if (totalPortfolioValueElem) totalPortfolioValueElem.textContent = `${formatNumber(totalPortfolioValue, 2)} USDT`;
    
    const totalResult = totalRealizedPnL + totalUnrealizedPnL;
    if (totalResultElem) {
        totalResultElem.textContent = `${formatNumber(totalResult, 2)} USDT`;
        
        if (totalResult >= 0) {
            totalResultElem.classList.add('positive');
            totalResultElem.classList.remove('negative');
        } else {
            totalResultElem.classList.add('negative');
            totalResultElem.classList.remove('positive');
        }
    }
    
    updateReportTable(currencyGroups);
}

function updateReportTable(currencyGroups) {
    const tbody = document.getElementById('report-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const allCurrencies = [...new Set(transactions.map(t => t.currency))];
    
    if (allCurrencies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Немає даних для відображення</td></tr>';
        return;
    }
    
    allCurrencies.forEach(currency => {
        const group = currencyGroups[currency] || {
            currency,
            totalInvested: 0,
            totalQuantity: 0,
            netQuantity: 0,
            totalCost: 0,
            realizedPnL: 0,
            totalSold: 0
        };
        
        const currentRate = currentRates[currency] || 0;
        const currentValue = group.netQuantity * currentRate;
        const unrealizedPnL = currentValue - group.totalCost;
        const unrealizedPnLPercent = group.totalCost > 0 ? (unrealizedPnL / group.totalCost) * 100 : 0;
        
        const realizedPnLPercent = group.totalInvested > 0 ? (group.realizedPnL / group.totalInvested) * 100 : 0;
        
        const row = document.createElement('tr');
        if (group.netQuantity <= 0) {
            row.classList.add('zero-balance-row');
        }
        
        row.innerHTML = `
            <td>${currency} ${group.netQuantity <= 0 ? '<span style="color: #999; font-size: 0.9em;">(продано)</span>' : ''}</td>
            <td class="number-cell">${formatNumber(group.netQuantity, 6)}</td>
            <td class="number-cell">${formatNumber(group.avgPrice, 4)}</td>
            <td class="number-cell">${formatNumber(currentRate, 4)}</td>
            <td class="number-cell ${unrealizedPnL >= 0 ? 'positive' : 'negative'}">
                ${formatNumber(unrealizedPnL, 2)}
            </td>
            <td class="number-cell ${unrealizedPnLPercent >= 0 ? 'positive' : 'negative'}">
                ${formatNumber(unrealizedPnLPercent, 2)}%
            </td>
            <td class="number-cell ${group.realizedPnL >= 0 ? 'positive' : 'negative'}">
                ${formatNumber(group.realizedPnL, 2)}
            </td>
            <td class="number-cell ${realizedPnLPercent >= 0 ? 'positive' : 'negative'}">
                ${formatNumber(realizedPnLPercent, 2)}%
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function updateCurrentRate(currency, rate) {
    currentRates[currency] = parseFloat(rate) || 0;
    saveCurrentRates();
    updatePortfolio();
    updateReport();
    
    // Автоматично зберігаємо в хмару після зміни курсу
    if (gistManager) {
        setTimeout(() => saveToGist(), 1000);
    }
}

function clearCurrentRate(currency) {
    currentRates[currency] = 0;
    saveCurrentRates();
    updatePortfolio();
    updateReport();
    
    // Автоматично зберігаємо в хмару після очищення курсу
    if (gistManager) {
        setTimeout(() => saveToGist(), 1000);
    }
}

function updateFileNameDisplay() {
    const fileNameElement = document.getElementById('fileName');
    if (fileNameElement) {
        fileNameElement.textContent = `Поточний файл: ${currentFileName}.json`;
    }
}

function getCurrencyIcon(currency) {
    const icons = {
        'BTC': '₿',
        'ETH': 'Ξ',
        'ADA': 'A',
        'DOT': '●',
        'SOL': '◎',
        'XRP': '✕',
        'DOGE': 'Ð',
        'LTC': 'Ł',
        'BNB': 'B',
        'LINK': '🔗'
    };
    return icons[currency] || '₿';
}

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

function exportData() {
    const dataToExport = {
        transactions: transactions,
        currentRates: currentRates,
        exportDate: new Date().toISOString(),
        fileName: currentFileName
    };
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    const fileName = `portfolio_${dateString}.json`;
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    currentFileName = file.name.replace('.json', '');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (importedData.transactions && Array.isArray(importedData.transactions)) {
                transactions = importedData.transactions;
                saveTransactions();
            }
            
            if (importedData.currentRates) {
                currentRates = importedData.currentRates;
                saveCurrentRates();
            }
            
            if (importedData.fileName) {
                currentFileName = importedData.fileName;
            }
            
            updateTransactionsTable();
            updatePortfolio();
            updateReport();
            updateFileNameDisplay();
            
            // Автоматично зберігаємо в хмару після імпорту
            if (gistManager) {
                setTimeout(() => saveToGist(), 1000);
            }
            
            alert('Дані успішно імпортовано!');
        } catch (error) {
            alert('Помилка при читанні файлу: ' + error.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ІНІЦІАЛІЗАЦІЯ
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
    addDebugInfo();
    updateTransactionsTable();
    updateFileNameDisplay();
    
    const importFile = document.getElementById('importFile');
    if (importFile) {
        importFile.addEventListener('change', handleFileImport);
    }
    
    console.log('✅ Додаток ініціалізовано');
});

// АВТОМАТИЧНЕ ЗБЕРЕЖЕННЯ ПРИ ЗАКРИТТІ
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
// АВТОМАТИЧНЕ ОНОВЛЕННЯ ДАНИХ КОЖНІ 30 СЕКУНД
function startAutoRefresh() {
    setInterval(() => {
        if (gistManager) {
            console.log('🔄 Автоматична перевірка оновлень...');
            checkForUpdates();
        }
    }, 30000); // Кожні 30 секунд
}

// ПЕРЕВІРКА ОНОВЛЕНЬ
let lastKnownGistVersion = null;

async function checkForUpdates() {
    if (!gistManager) return;
    
    try {
        const remoteData = await gistManager.loadGist();
        if (remoteData) {
            const currentVersion = JSON.stringify(remoteData);
            
            if (lastKnownGistVersion !== currentVersion) {
                console.log('📥 Виявлено нові дані, завантажую...');
                await loadFromGist();
                lastKnownGistVersion = currentVersion;
            }
        }
    } catch (error) {
        console.log('❌ Помилка перевірки оновлень:', error);
    }
}

// ПОКРАЩЕНА СИНХРОНІЗАЦІЯ ПІСЛЯ БУДЬ-ЯКОЇ ЗМІНИ
function setupAutoSync() {
    // Перехоплюємо всі функції, що змінюють дані
    const originalAddTransaction = addTransaction;
    const originalDeleteTransaction = deleteTransaction;
    const originalUpdateCurrentRate = updateCurrentRate;
    const originalClearCurrentRate = clearCurrentRate;
    
    // Огортаємо їх для автоматичної синхронізації
    window.addTransaction = function(...args) {
        const result = originalAddTransaction.apply(this, args);
        if (gistManager) {
            setTimeout(() => {
                console.log('💾 Автосинхронізація після додавання транзакції');
                saveToGist();
            }, 2000);
        }
        return result;
    };
    
    window.deleteTransaction = function(...args) {
        const result = originalDeleteTransaction.apply(this, args);
        if (result && gistManager) { // result = true, якщо видалення підтверджено
            setTimeout(() => {
                console.log('💾 Автосинхронізація після видалення транзакції');
                saveToGist();
            }, 2000);
        }
        return result;
    };
    
    window.updateCurrentRate = function(...args) {
        const result = originalUpdateCurrentRate.apply(this, args);
        if (gistManager) {
            setTimeout(() => {
                console.log('💾 Автосинхронізація після зміни курсу');
                saveToGist();
            }, 2000);
        }
        return result;
    };
    
    window.clearCurrentRate = function(...args) {
        const result = originalClearCurrentRate.apply(this, args);
        if (gistManager) {
            setTimeout(() => {
                console.log('💾 Автосинхронізація після очищення курсу');
                saveToGist();
            }, 2000);
        }
        return result;
    };
}

// ДОДАЄМО КНОПКУ ДЛЯ ПРИМУСОВОГО ОНОВЛЕННЯ
function addForceRefreshButton() {
    const syncControls = document.getElementById('sync-controls');
    if (syncControls) {
        const refreshButton = document.createElement('button');
        refreshButton.textContent = '🔄 Примусове оновлення';
        refreshButton.onclick = () => {
            console.log('🔧 Примусове оновлення даних...');
            loadFromGist();
        };
        refreshButton.style.marginLeft = '10px';
        syncControls.appendChild(refreshButton);
    }
}

// ОНОВЛЮЄМО ІНІЦІАЛІЗАЦІЮ
document.addEventListener('DOMContentLoaded', function() {
    // Твій існуючий код ініціалізації...
    
    // Додаємо нові функції
    setTimeout(() => {
        startAutoRefresh();
        setupAutoSync();
        addForceRefreshButton();
        
        // Встановлюємо початкову версію даних
        if (gistManager) {
            checkForUpdates();
        }
    }, 5000); // Запускаємо через 5 секунд після завантаження
});
});