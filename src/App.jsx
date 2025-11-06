import React, { useState, useEffect, useCallback } from 'react';
import { CloudSun, DollarSign, MessageSquare, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

// --- CONFIGURATION AND MOCKED API SETUP ---

// Configuration for the simulated backend/API interaction
const API_CONFIG = {
    // Note: The apiKey is left blank as per instructions, Canvas provides it at runtime.
    apiKey: "AIzaSyCnVFOEQfl1YC2QgsDqkv5_1azIC1oMl4k",
    model: "gemini-2.5-flash-preview-09-2025",
    // This endpoint is used for dynamic content generation (Motivational Quote)
    apiUrl: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=AIzaSyCnVFOEQfl1YC2QgsDqkv5_1azIC1oMl4k`, 
};

/**
 * Utility to simulate exponential backoff for API retries.
 * @param {Function} apiCall - The async function to execute.
 * @param {number} maxRetries - Maximum number of retries.
 * @returns The result of the successful API call.
 */
const withBackoff = async (apiCall, maxRetries = 3) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const result = await apiCall();
            return result;
        } catch (error) {
            if (attempt === maxRetries - 1) {
                console.error("API call failed after max retries:", error);
                throw new Error("Service currently unavailable. Please try again later.");
            }
            // FIX: Ensure delay is calculated and used for exponential backoff.
            const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// --- MOCK API FUNCTIONS (SIMULATING BACKEND ENDPOINTS) ---

/**
 * Mocks a real-time weather API call.
 */
const fetchMockWeather = (city = 'Bengaluru, IN') => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (Math.random() < 0.1) { // 10% chance of failure for error handling demo
                reject(new Error(`Could not fetch weather for ${city}. Try another city.`));
                return;
            }
            
            const temperature = (Math.random() * 15 + 20).toFixed(1); // 20.0 to 35.0 C
            const conditions = ['Partly Cloudy', 'Sunny', 'Light Rain', 'Hazy'].at(Math.floor(Math.random() * 4));

            resolve({
                city,
                temp: temperature,
                condition: conditions,
                windSpeed: (Math.random() * 10 + 5).toFixed(1),
            });
        }, 100); // Simulate network latency
    });
};

/**
 * Mocks a real-time currency exchange rate API call.
 */
const fetchMockConversion = (amountINR) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (isNaN(amountINR) || amountINR <= 0) {
                reject(new Error("Invalid amount. Please enter a positive number."));
                return;
            }
            
            // Fixed mock rates (as of a hypothetical date)
            const INR_TO_USD = 1 / 88.3;
            const INR_TO_EUR = 1 / 98.0;

            resolve({
                usd: (amountINR * INR_TO_USD).toFixed(2),
                eur: (amountINR * INR_TO_EUR).toFixed(2),
                timestamp: new Date().toLocaleTimeString(),
            });
        }, 1000);
    });
};

/**
 * Simulates a call to a quote generator API endpoint (using Gemini structure).
 */
// --- LOCAL QUOTES FOR OFFLINE / MOCK MODE ---
const LOCAL_QUOTES = [
  "Don't watch the clock; do what it does. Keep going.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "The only way to achieve the impossible is to believe it is possible.",
  "Act as if what you do makes a difference. It does.",
  "Start where you are. Use what you have. Do what you can."
];

// --- IMPROVED FETCH FUNCTION ---
const fetchMotivationalQuote = async () => {
  // quick local fallback
  const randomLocal = () => LOCAL_QUOTES[Math.floor(Math.random() * LOCAL_QUOTES.length)];

  // If no API key, return local immediately
  if (!API_CONFIG.apiKey) {
    return randomLocal();
  }

  const userQuery = "Generate a short, powerful, and unique motivational quote. Return only the quote text.";
  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: { parts: [{ text: "You are a creative quote generator. Provide concise inspiring quotes." }] }
  };
  const apiUrlWithKey = API_CONFIG.apiUrl + API_CONFIG.apiKey;

  try {
    const response = await withBackoff(() =>
      fetch(apiUrlWithKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    );
    if (!response.ok) throw new Error(`API status ${response.status}`);
    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text && text.trim().length > 0) return text.trim().replace(/^['"\s]*|['"\s]*$/g, '');
    return randomLocal();
  } catch (err) {
    console.warn("Quote API failed, using local fallback:", err);
    return randomLocal();
  }
};


// --- COMMON UI COMPONENTS ---

const Card = ({ children, title, icon: Icon }) => (
  <div className="hub-card">
    <h2 className="text-3xl font-extrabold text-[var(--brand)] mb-4 flex items-center">
      {Icon && <Icon className="w-7 h-7 mr-3 text-[var(--brand)]" />}
      {title}
    </h2>
    {children}
  </div>
);


const Loader = ({ message = "Loading data..." }) => (
    <div className="flex flex-col items-center justify-center p-8 text-indigo-500">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-lg font-medium">{message}</p>
    </div>
);

const ErrorMessage = ({ message, onRetry }) => (
    <div className="bg-red-50 border border-red-200 p-6 rounded-lg text-red-700 space-y-3">
        <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <span className="font-semibold">Error:</span>
        </div>
        <p>{message}</p>
        {onRetry && (
            <button
                onClick={onRetry}
                className="flex items-center text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
            </button>
        )}
    </div>
);


// --- MODULE 1: WEATHER INFORMATION ---

const WeatherModule = () => {
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [cityInput, setCityInput] = useState('Bengaluru, IN');

    const loadWeather = useCallback(async (city) => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchMockWeather(city);
            setWeather(data);
        } catch (err) {
            setError(err.message);
            setWeather(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadWeather(cityInput);
    }, [loadWeather, cityInput]);
    
    const handleSearch = (e) => {
        e.preventDefault();
        loadWeather(cityInput);
    }

    return (
        <Card title="Weather Hub" icon={CloudSun}>
            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    placeholder="Enter city, e.g., London, UK"
                    className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={loading}
                />
                <button
                    type="submit"
                    className="bg-indigo-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                    disabled={loading}
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Search'}
                </button>
            </form>

            {loading && <Loader message={`Fetching weather for ${cityInput}...`} />}
            
            {error && <ErrorMessage message={error} onRetry={() => loadWeather(cityInput)} />}

            {weather && !loading && (
                <div className="mt-4 bg-indigo-50 p-6 rounded-xl shadow-inner border-l-4 border-indigo-600 grid grid-cols-2 gap-4">
                    <div className="text-5xl font-bold text-indigo-800 col-span-2 md:col-span-1">
                        {weather.temp}°C
                    </div>
                    <div className="col-span-2 md:col-span-1 flex flex-col justify-center">
                        <p className="text-xl font-semibold text-gray-800">{weather.city}</p>
                        <p className="text-lg text-indigo-600">{weather.condition}</p>
                    </div>
                    <div className="col-span-2 md:col-span-2 pt-4 border-t border-indigo-200 text-sm text-gray-600">
                        <p>Wind Speed: {weather.windSpeed} km/h</p>
                        <p>Data Status: Live (Mocked)</p>
                    </div>
                </div>
            )}
        </Card>
    );
};

// --- MODULE 2: CURRENCY CONVERTER ---

const ConverterModule = () => {
    const [amountINR, setAmountINR] = useState(100);
    const [conversion, setConversion] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const convertCurrency = useCallback(async (amount) => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchMockConversion(amount);
            setConversion(data);
        } catch (err) {
            setError(err.message);
            setConversion(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial load
        convertCurrency(amountINR);
    }, [convertCurrency, amountINR]);

    const handleInput = (e) => {
        const value = e.target.value;
        const numValue = parseFloat(value);
        setAmountINR(value);
        if (!isNaN(numValue) && numValue > 0) {
            convertCurrency(numValue);
        } else if (value === '') {
            // Allow empty state but clear conversion result
            setConversion(null);
            setError(null);
        } else {
            setError("Please enter a valid amount.");
            setConversion(null);
        }
    };

    return (
        <Card title="Currency Converter" icon={DollarSign}>
            <p className="text-gray-600 mb-4">Convert Indian Rupees (INR) to popular currencies.</p>

            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="inr-input">
                    Amount in INR (₹)
                </label>
                <input
                    id="inr-input"
                    type="number"
                    step="0.01"
                    value={amountINR}
                    onChange={handleInput}
                    placeholder="Enter amount"
                    className="w-full p-3 border border-gray-300 rounded-lg text-2xl font-bold focus:ring-indigo-500 focus:border-indigo-500"
                    min="0"
                    disabled={loading}
                />
            </div>
            
            {loading && <Loader message="Converting currency..." />}
            
            {error && <ErrorMessage message={error} onRetry={() => convertCurrency(parseFloat(amountINR))} />}

            {conversion && !loading && !error && (
                <div className="bg-green-50 p-6 rounded-xl shadow-inner grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border-b md:border-b-0 md:border-r border-green-200 pb-4 md:pb-0 md:pr-4">
                        <p className="text-sm text-green-700 font-medium mb-1">US Dollars (USD)</p>
                        <p className="text-3xl font-extrabold text-green-800">${conversion.usd}</p>
                    </div>
                    <div className="pt-4 md:pt-0">
                        <p className="text-sm text-green-700 font-medium mb-1">Euros (EUR)</p>
                        <p className="text-3xl font-extrabold text-green-800">€{conversion.eur}</p>
                    </div>
                    <p className="col-span-2 text-xs text-gray-500 mt-2">
                        Last updated: {conversion.timestamp} (Mock Rates: 1 USD ≈ 88.3 INR, 1 EUR ≈ 98.0 INR)
                    </p>
                </div>
            )}
        </Card>
    );
};


// --- MODULE 3: MOTIVATIONAL QUOTE GENERATOR ---

const QuoteModule = () => {
    const [quote, setQuote] = useState("Click 'Generate' to get your daily dose of motivation.");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadQuote = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const newQuote = await fetchMotivationalQuote();
            setQuote(newQuote);
        } catch (err) {
            setError(err.message);
            // On API failure, display the error but keep the default/last generated quote
        } finally {
            setLoading(false);
        }
    }, []);

    return (
        <Card title="Quote Generator" icon={MessageSquare}>
            <div className="bg-yellow-50 p-6 rounded-xl shadow-inner min-h-[150px] flex items-center justify-center mb-6">
                {loading ? (
                    <Loader message="Generating inspiration..." />
                ) : (
                    <p className="text-2xl italic font-serif text-gray-800 text-center leading-relaxed">
                        &ldquo;{quote}&rdquo;
                    </p>
                )}
            </div>

            {error && <ErrorMessage message={error} />}

            <div className="flex justify-center">
                <button
                    onClick={loadQuote}
                    className="flex items-center bg-indigo-600 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-700 transition transform hover:scale-105 disabled:opacity-50"
                    disabled={loading}
                >
                    <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Generate New Quote
                </button>
            </div>
        </Card>
    );
};


// --- MAIN APP COMPONENT ---

const Modules = {
    WEATHER: 'WEATHER',
    CONVERTER: 'CONVERTER',
    QUOTES: 'QUOTES'
};

const App = () => {
    const [activeModule, setActiveModule] = useState(Modules.WEATHER);

    const renderModule = () => {
        switch (activeModule) {
            case Modules.WEATHER:
                return <WeatherModule />;
            case Modules.CONVERTER:
                return <ConverterModule />;
            case Modules.QUOTES:
                return <QuoteModule />;
            default:
                return <WeatherModule />;
        }
    };

    const NavButton = ({ module, icon: Icon, label }) => (
  <button
    onClick={() => setActiveModule(module)}
    className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm
      ${activeModule === module ? 'pill-active' : 'pill-inactive'}`}
  >
    <Icon className="w-5 h-5" />
    <span>{label}</span>
  </button>
);


    return (
  <div className="min-h-screen bg-gray-50 font-sans">
    <header className="app-header main-wrapper">
      <h1 className="app-title">
        ByteXL <span className="text-[var(--brand)]">InfoHub</span>
      </h1>
      <p className="app-sub">Your essential daily utilities, all in one place.</p>
    </header>

    <nav className="main-wrapper mb-10">
      <div className="nav-pill-container">
        <NavButton module={Modules.WEATHER} icon={CloudSun} label="Weather" />
        <NavButton module={Modules.CONVERTER} icon={DollarSign} label="Currency Converter" />
        <NavButton module={Modules.QUOTES} icon={MessageSquare} label="Motivational Quotes" />
      </div>
    </nav>

    <main className="main-wrapper">
      {renderModule()}
    </main>

  </div>
);

};

export default App;