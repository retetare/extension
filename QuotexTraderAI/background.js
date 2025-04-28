// Background script for the Quotex AI Trading Signals extension
// Handles data processing and communication between content script and popup

// Constants for timeframes
const TIMEFRAMES = {
  M1: 60 * 1000,        // 1 minute in milliseconds
  M5: 5 * 60 * 1000,    // 5 minutes in milliseconds
  M15: 15 * 60 * 1000   // 15 minutes in milliseconds
};

// Initialize state
let state = {
  isActive: false,
  selectedTimeframe: 'M1',
  signals: {},
  candleData: {},
  accuracyStats: {
    totalSignals: 0,
    correctSignals: 0
  }
};

// Get API key from environment or use a default placeholder
// In production, this would be properly secured
const GEMINI_API_KEY = "";  // This will be provided by the user

// Process candle data and generate signals
async function processData(candleData, timeframe) {
  try {
    // Store candle data for the selected timeframe
    state.candleData[timeframe] = candleData;
    
    // Calculate technical indicators
    const indicators = await calculateIndicators(candleData, timeframe);
    
    // Get AI analysis
    const aiAnalysis = await getAIPrediction(candleData, indicators, timeframe);
    
    // Generate signal based on indicators and AI analysis
    const signal = generateSignal(indicators, aiAnalysis);
    
    // Store the signal
    state.signals[timeframe] = {
      ...signal,
      timestamp: Date.now(),
      indicators: indicators
    };
    
    // Send message to content script and popup
    notifySignalUpdate(timeframe);
    
    return signal;
  } catch (error) {
    console.error('Error processing data:', error);
    return null;
  }
}

// Calculate technical indicators based on candle data
async function calculateIndicators(candleData, timeframe) {
  // This will use the indicator formulas from the utils/indicators.js file
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'calculateIndicators',
      data: { candleData, timeframe }
    }, (response) => {
      resolve(response.indicators);
    });
  });
}

// Get AI prediction using Gemini API
async function getAIPrediction(candleData, indicators, timeframe) {
  if (!GEMINI_API_KEY) {
    console.warn('No Gemini API key provided. Skipping AI analysis.');
    return { prediction: 'neutral', confidence: 0.5 };
  }
  
  try {
    // Format data for Gemini API
    const formattedData = formatDataForAI(candleData, indicators, timeframe);
    
    // Make API request
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GEMINI_API_KEY}`
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze this trading data and predict whether the price will go UP or DOWN in the next period. 
            Return a JSON object with 'prediction' (either 'up', 'down', or 'neutral') and 'confidence' (0 to 1).
            
            Timeframe: ${timeframe}
            Technical Indicators: ${JSON.stringify(indicators)}
            Recent Price Action: ${JSON.stringify(candleData.slice(-10))}
            `
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 100,
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Extract and parse the JSON from the response
    try {
      const textContent = result.candidates[0].content.parts[0].text;
      const jsonMatch = textContent.match(/\{.*\}/s);
      if (jsonMatch) {
        const aiResponse = JSON.parse(jsonMatch[0]);
        return {
          prediction: aiResponse.prediction || 'neutral',
          confidence: aiResponse.confidence || 0.5
        };
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
    }
    
    return { prediction: 'neutral', confidence: 0.5 };
  } catch (error) {
    console.error('Error getting AI prediction:', error);
    return { prediction: 'neutral', confidence: 0.5 };
  }
}

// Format data for AI analysis
function formatDataForAI(candleData, indicators, timeframe) {
  // Extract relevant data points for AI analysis
  return {
    timeframe,
    indicators,
    recentCandles: candleData.slice(-20) // Last 20 candles
  };
}

// Generate trading signal based on indicators and AI analysis
function generateSignal(indicators, aiAnalysis) {
  // Default values
  let signalType = 'neutral';
  let strength = 0;
  let recommendation = 'Hold';
  
  // Determine signal based on indicator values and AI prediction
  const { ema, macd, rsi, bb, volume } = indicators;
  const { prediction, confidence } = aiAnalysis;
  
  // Calculate signal strength (0-100)
  let signalPoints = 0;
  
  // EMA crossover (20 points max)
  if (ema.crossover === 'bullish') signalPoints += 20;
  else if (ema.crossover === 'bearish') signalPoints -= 20;
  
  // MACD signal (20 points max)
  if (macd.histogram > 0 && macd.histogram > macd.previousHistogram) signalPoints += 20;
  else if (macd.histogram < 0 && macd.histogram < macd.previousHistogram) signalPoints -= 20;
  
  // RSI signals (15 points max)
  if (rsi.value < 30) signalPoints += 15; // Oversold
  else if (rsi.value > 70) signalPoints -= 15; // Overbought
  
  // Bollinger Bands (15 points max)
  if (bb.position === 'lower') signalPoints += 15;
  else if (bb.position === 'upper') signalPoints -= 15;
  
  // Volume confirmation (10 points max)
  if (volume.trend === 'increasing') {
    if (signalPoints > 0) signalPoints += 10;
    else if (signalPoints < 0) signalPoints -= 10;
  }
  
  // AI prediction (20 points max)
  if (prediction === 'up') signalPoints += 20 * confidence;
  else if (prediction === 'down') signalPoints -= 20 * confidence;
  
  // Determine final signal type and strength
  if (signalPoints > 30) {
    signalType = 'buy';
    strength = Math.min(Math.abs(signalPoints), 100);
    recommendation = 'Buy';
  } else if (signalPoints < -30) {
    signalType = 'sell';
    strength = Math.min(Math.abs(signalPoints), 100);
    recommendation = 'Sell';
  } else {
    signalType = 'neutral';
    strength = Math.min(Math.abs(signalPoints), 100);
    recommendation = 'Hold';
  }
  
  return {
    type: signalType,
    strength: strength,
    recommendation: recommendation,
    aiConfidence: confidence,
    details: {
      ema: ema.crossover,
      macd: macd.histogram > 0 ? 'bullish' : 'bearish',
      rsi: rsi.value,
      bb: bb.position,
      volume: volume.trend
    }
  };
}

// Notify content script and popup about signal update
function notifySignalUpdate(timeframe) {
  chrome.runtime.sendMessage({
    action: 'signalUpdated',
    data: {
      timeframe,
      signal: state.signals[timeframe]
    }
  });
}

// Track signal accuracy when a result is known
function trackSignalAccuracy(signalType, result) {
  state.accuracyStats.totalSignals++;
  
  if ((signalType === 'buy' && result === 'win') || 
      (signalType === 'sell' && result === 'win')) {
    state.accuracyStats.correctSignals++;
  }
  
  // Store updated stats
  chrome.storage.local.set({ accuracyStats: state.accuracyStats });
  
  // Return current accuracy percentage
  return (state.accuracyStats.correctSignals / state.accuracyStats.totalSignals) * 100;
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'toggleActive':
      state.isActive = request.data.isActive;
      sendResponse({ success: true, isActive: state.isActive });
      break;
      
    case 'setTimeframe':
      state.selectedTimeframe = request.data.timeframe;
      sendResponse({ success: true, timeframe: state.selectedTimeframe });
      break;
      
    case 'newCandleData':
      processData(request.data.candleData, request.data.timeframe)
        .then(signal => {
          sendResponse({ success: true, signal });
        })
        .catch(error => {
          console.error('Error processing candle data:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep connection open for async response
      
    case 'getState':
      sendResponse({ success: true, state });
      break;
      
    case 'trackSignalResult':
      const accuracy = trackSignalAccuracy(
        request.data.signalType, 
        request.data.result
      );
      sendResponse({ success: true, accuracy });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Initialize extension when installed
chrome.runtime.onInstalled.addListener(() => {
  // Load any saved state
  chrome.storage.local.get(['accuracyStats'], (result) => {
    if (result.accuracyStats) {
      state.accuracyStats = result.accuracyStats;
    }
  });
  
  console.log('Quotex AI Trading Signals extension installed');
});
