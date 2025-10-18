// Gist менеджер для синхронізації
class GistManager {
    constructor(token) {
        this.token = token;
        this.gistId = localStorage.getItem('portfolioGistId');
    }

    // Створити новий Gist
    async createGist(portfolioData) {
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

        const gist = await response.json();
        this.gistId = gist.id;
        localStorage.setItem('portfolioGistId', gist.id);
        return gist;
    }

    // Оновити Gist
    async updateGist(portfolioData) {
        if (!this.gistId) {
            return await this.createGist(portfolioData);
        }

        const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    "portfolio.json": {
                        content: JSON.stringify(portfolioData, null, 2)
                    }
                }
            })
        });

        return await response.json();
    }

    // Завантажити з Gist
    async loadGist() {
        if (!this.gistId) return null;

        const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
            headers: {
                'Authorization': `token ${this.token}`
            }
        });

        const gist = await response.json();
        const content = gist.files['portfolio.json'].content;
        return JSON.parse(content);
    }
}

// Глобальні змінні для синхронізації
let gistManager = null;

// Зберігання поточних курсів для кожної валюти
let currentRates = {};

// Назва поточного файлу
let currentFileName = "portfolio_data";

// НОВА МАТЕМАТИКА: Використання цілих чисел для уникнення проблем з плаваючою комою
const PRECISION_FACTOR = 1000000; // 1 мільйон для мікро-одиниць

// Функції для роботи з високою точністю
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

// Функція для форматування чисел
function formatNumber(number, decimals = 6) {
    if (number === 0 || number === null || number === undefined) return '0';
    
    let rounded = preciseRound(number, decimals);
    let formatted = parseFloat(rounded.toFixed(decimals)).toString();
    
    if (formatted.indexOf('.') === -1 && decimals > 0) {
        formatted += '.0';
    }
    
    return formatted;
}

// Функції для порівняння чисел з допуском
function floatEquals(a, b, tolerance = 1e-10) {
    return Math.abs(a - b) < tolerance;
}

function floatLessOrEqual(a, b, tolerance = 1e-10) {
    return a <= b || floatEquals(a, b, tolerance);
}

// СИНХРОНІЗАЦІЯ З GIST
function setupSync() {
    const tokenInput = document.getElementById('github-token');
    const token = tokenInput.value.trim();
    
    if (!token) {
        alert('Будь ласка, введіть GitHub Personal Access Token');
        return;
    }
    
    try {
        gistManager = new GistManager(token);
        localStorage.setItem('githubToken', token);
        
        // Приховати поле вводу токена, показати кнопки синхронізації
        document.getElementById('token-input').style.display = 'none';
        document.getElementById('sync-controls').style.display = 'flex';
        document.getElementById('sync-status').textContent = 'Синхронізація налаштована!';
        
        // Спробувати завантажити дані з хмари
        loadFromGist();
        
    } catch (error) {
        alert('Помилка налаштування синхронізації: ' + error.message);
    }
}

async function saveToGist() {
    if (!gistManager) {
        alert('Спочатку налаштуйте синхронізацію');
        return;
    }
    
    try {
        const portfolioData = {
            transactions: transactions,
            currentRates: currentRates,
            fileName: currentFileName,
            lastSync: new Date().toISOString()
        };
        
        await gistManager.updateGist(portfolioData);
        document.getElementById('sync-status').textContent = 'Збережено: ' + new Date().toLocaleTimeString();
        
    } catch (error) {
        document.getElementById('sync-status').textContent = 'Помилка збереження';
        console.error('Gist помилка:', error);
        alert('Помилка збереження в хмару: ' + error.message);
    }
}

async function loadFromGist() {
    if (!gistManager) {
        alert('Спочатку налаштуйте синхронізацію');
        return;
    }
    
    try {
        const remoteData = await gistManager.loadGist();
        if (remoteData) {
            // Запитуємо підтвердження перед заміною даних
            if (confirm('Завантажити дані з хмари? Поточні дані будуть замінені.')) {
                if (remoteData.transactions) {
                    transactions = remoteData.transactions;
                    saveTransactions();
                }
                
                if (remoteData.currentRates) {
                    currentRates = remoteData.currentRates;
                    saveCurrentRates();
                }
                
                if (remoteData.fileName) {
                    currentFileName = remoteData.fileName;
                }
                
                updateTransactionsTable();
                updatePortfolio();
                updateReport();
                updateFileNameDisplay();
                
                document.getElementById('sync-status').textContent = 'Завантажено: ' + new Date().toLocaleTimeString();
            }
        } else {
            document.getElementById('sync-status').textContent = 'Немає даних в хмарі';
        }
    } catch (error) {
        document.getElementById('sync-status').textContent = 'Помилка завантаження';
        console.error('Gist помилка:', error);
        alert('Помилка завантаження з хмари: ' + error.message);
    }
}

// Перевірка збереженого токена при завантаженні
function checkSavedToken() {
    const savedToken = localStorage.getItem('githubToken');
    if (savedToken) {
        gistManager = new GistManager(savedToken);
        document.getElementById('token-input').style.display = 'none';
        document.getElementById('sync-controls').style.display = 'flex';
        document.getElementById('sync-status').textContent = 'Синхронізація активна';
    }
}

// ОРИГІНАЛЬНИЙ КОД ДОДАТКУ (залишається незмінним)
let transactions = [];

function loadTransactions() {
    const storedTransactions = localStorage.getItem('cryptoTransactions');
    if (storedTransactions) {
        transactions = JSON.parse(storedTransactions);
    }
}

function loadCurrentRates() {
    const storedRates = localStorage.getItem('cryptoCurrentRates');
    if (storedRates) {
        currentRates = JSON.parse(storedRates);
    }
}

function saveCurrentRates() {
    localStorage.setItem('cryptoCurrentRates', JSON.stringify(currentRates));
}

function saveTransactions() {
    localStorage.setItem('cryptoTransactions', JSON.stringify(transactions));
}

// Проста функція для перемикання вкладок
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

// Ініціалізація додатку
document.addEventListener('DOMContentLoaded', function() {
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
    checkSavedToken(); // Перевіряємо збережений токен
    updateTransactionsTable();
    updateFileNameDisplay();
    document.getElementById('importFile').addEventListener('change', handleFileImport);
});

// Решта оригінальних функцій залишаються незмінними...
// [Тут має бути весь решта твого оригінального JavaScript коду]
// Додаю лише ключові функції для демонстрації:

function initForm() {
    // Твій оригінальний код ініціалізації форми
    const typeButtons = document.querySelectorAll('.type-btn');
    const submitButton = document.getElementById('submit-btn');
    // ... решта коду
}

function addTransaction() {
    // Твій оригінальний код додавання транзакції
}

function updateTransactionsTable() {
    // Твій оригінальний код оновлення таблиці
}

function updatePortfolio() {
    // Твій оригінальний код оновлення портфеля
}

function updateReport() {
    // Твій оригінальний код оновлення звіту
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
            
            alert('Дані успішно імпортовано!');
        } catch (error) {
            alert('Помилка при читанні файлу: ' + error.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function updateFileNameDisplay() {
    document.getElementById('fileName').textContent = `Поточний файл: ${currentFileName}.json`;
}

// Додаю решту необхідних функцій з твого оригінального коду
function calculateCurrencyGroups() {
    // Твій оригінальний код розрахунку груп валют
    const groups = {};
    // ... реалізація
    return groups;
}

function updateCurrentRate(currency, rate) {
    currentRates[currency] = parseFloat(rate) || 0;
    saveCurrentRates();
    updatePortfolio();
    updateReport();
}

function clearCurrentRate(currency) {
    currentRates[currency] = 0;
    saveCurrentRates();
    updatePortfolio();
    updateReport();
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