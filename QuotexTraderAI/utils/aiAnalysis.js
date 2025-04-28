/**
 * AI Analysis module for Quotex AI Trading Signals
 * 
 * This module provides functions for AI-based analysis of trading data
 * using the Gemini API for pattern recognition and prediction.
 */

// Default API key placeholder (should be provided by user in actual implementation)
const DEFAULT_API_KEY = "";

/**
 * Get AI prediction for trading data
 * @param {Object} apiKey - Gemini API key
 * @param {Array} candles - Array of candle data
 * @param {Object} indicators - Technical indicators
 * @param {string} timeframe - Selected timeframe
 * @returns {Promise<Object>} Promise resolving to prediction result
 */
async function getAIPrediction(apiKey, candles, indicators, timeframe) {
  try {
    // Check if API key is provided
    if (!apiKey) {
      console.warn('No Gemini API key provided. Using pattern-based prediction fallback.');
      return getPatternBasedPrediction(candles, indicators);
    }
    
    // Prepare data for AI analysis
    const analysisData = prepareDataForAI(candles, indicators, timeframe);
    
    // Make API request to Gemini
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze this trading data and predict whether the price will go UP or DOWN in the next period. 
            Return a JSON object with 'prediction' (either 'up', 'down', or 'neutral') and 'confidence' (0 to 1).
            
            Timeframe: ${timeframe}
            Technical Indicators: ${JSON.stringify(indicators)}
            Recent Price Action: ${JSON.stringify(candles.slice(-10))}
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
    
    // Extract and parse JSON from response
    try {
      const textContent = result.candidates[0].content.parts[0].text;
      const jsonMatch = textContent.match(/\{.*\}/s);
      
      if (jsonMatch) {
        const aiResponse = JSON.parse(jsonMatch[0]);
        return {
          prediction: aiResponse.prediction || 'neutral',
          confidence: aiResponse.confidence || 0.5,
          source: 'gemini'
        };
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
    }
    
    // Fallback to pattern-based prediction
    return getPatternBasedPrediction(candles, indicators);
  } catch (error) {
    console.error('Error getting AI prediction:', error);
    return getPatternBasedPrediction(candles, indicators);
  }
}

/**
 * Prepare data for AI analysis
 * @param {Array} candles - Array of candle data
 * @param {Object} indicators - Technical indicators
 * @param {string} timeframe - Selected timeframe
 * @returns {Object} Formatted data for AI analysis
 */
function prepareDataForAI(candles, indicators, timeframe) {
  // Extract the most relevant data for AI analysis
  const recentCandles = candles.slice(-20).map(candle => ({
    timestamp: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume || 0
  }));
  
  // Calculate price action statistics
  const closes = recentCandles.map(candle => candle.close);
  const priceChange = closes[closes.length - 1] - closes[0];
  const priceChangePercent = (priceChange / closes[0]) * 100;
  
  // Calculate volatility
  let volatility = 0;
  for (let i = 1; i < closes.length; i++) {
    volatility += Math.abs(closes[i] - closes[i - 1]) / closes[i - 1];
  }
  volatility = (volatility / (closes.length - 1)) * 100;
  
  return {
    timeframe,
    recentCandles,
    indicators,
    statistics: {
      priceChange,
      priceChangePercent,
      volatility
    }
  };
}

/**
 * Get pattern-based prediction (fallback when AI is not available)
 * @param {Array} candles - Array of candle data
 * @param {Object} indicators - Technical indicators
 * @returns {Object} Prediction based on technical patterns
 */
function getPatternBasedPrediction(candles, indicators) {
  // Initialize prediction variables
  let predictionScore = 0;
  let confidenceScore = 0.5;
  
  // 1. Check EMA crossover (weight: 25%)
  if (indicators.ema.crossover === 'bullish') {
    predictionScore += 25;
    confidenceScore += 0.1;
  } else if (indicators.ema.crossover === 'bearish') {
    predictionScore -= 25;
    confidenceScore += 0.1;
  }
  
  // 2. Check MACD (weight: 20%)
  if (indicators.macd.histogram > 0 && indicators.macd.histogram > indicators.macd.previousHistogram) {
    predictionScore += 20;
    confidenceScore += 0.08;
  } else if (indicators.macd.histogram < 0 && indicators.macd.histogram < indicators.macd.previousHistogram) {
    predictionScore -= 20;
    confidenceScore += 0.08;
  }
  
  // 3. Check RSI (weight: 15%)
  if (indicators.rsi.value < 30) {
    predictionScore += 15; // Oversold, likely to go up
    confidenceScore += 0.06;
  } else if (indicators.rsi.value > 70) {
    predictionScore -= 15; // Overbought, likely to go down
    confidenceScore += 0.06;
  }
  
  // 4. Check Bollinger Bands (weight: 20%)
  if (indicators.bb.position === 'lower') {
    predictionScore += 20; // Price at lower band, likely to go up
    confidenceScore += 0.08;
  } else if (indicators.bb.position === 'upper') {
    predictionScore -= 20; // Price at upper band, likely to go down
    confidenceScore += 0.08;
  }
  
  // 5. Check Volume (weight: 10%)
  if (indicators.volume.trend === 'increasing') {
    // Volume confirms the direction
    if (predictionScore > 0) {
      predictionScore += 10;
      confidenceScore += 0.04;
    } else if (predictionScore < 0) {
      predictionScore -= 10;
      confidenceScore += 0.04;
    }
  }
  
  // 6. Check for candlestick patterns (weight: 10%)
  const patternResult = detectCandlestickPatterns(candles);
  predictionScore += patternResult.score;
  confidenceScore += patternResult.confidence;
  
  // Determine final prediction
  let prediction = 'neutral';
  if (predictionScore > 15) {
    prediction = 'up';
  } else if (predictionScore < -15) {
    prediction = 'down';
  }
  
  // Ensure confidence is within bounds
  confidenceScore = Math.min(Math.max(confidenceScore, 0.3), 0.85);
  
  return {
    prediction,
    confidence: confidenceScore,
    source: 'pattern'
  };
}

/**
 * Detect candlestick patterns in price data
 * @param {Array} candles - Array of candle data
 * @returns {Object} Pattern detection result with score and confidence
 */
function detectCandlestickPatterns(candles) {
  if (candles.length < 5) {
    return { score: 0, confidence: 0 };
  }
  
  let score = 0;
  let confidence = 0;
  
  // Get recent candles
  const recent = candles.slice(-5);
  
  // 1. Detect doji (neutral)
  const lastCandle = recent[recent.length - 1];
  const bodySize = Math.abs(lastCandle.close - lastCandle.open);
  const totalSize = lastCandle.high - lastCandle.low;
  
  if (bodySize / totalSize < 0.1) {
    // Doji detected - indecision
    return { score: 0, confidence: 0.02 };
  }
  
  // 2. Detect hammer/hanging man (potential reversal)
  const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
  const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
  
  if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5) {
    // Hammer pattern - bullish at bottom, bearish at top
    const trend = detectTrend(candles);
    
    if (trend === 'downtrend') {
      return { score: 10, confidence: 0.04 }; // Bullish reversal
    } else if (trend === 'uptrend') {
      return { score: -10, confidence: 0.04 }; // Bearish reversal
    }
  }
  
  // 3. Detect engulfing pattern
  const previousCandle = recent[recent.length - 2];
  const lastBullish = lastCandle.close > lastCandle.open;
  const prevBullish = previousCandle.close > previousCandle.open;
  
  if (lastBullish && !prevBullish) {
    if (lastCandle.open < previousCandle.close && lastCandle.close > previousCandle.open) {
      // Bullish engulfing
      return { score: 10, confidence: 0.05 };
    }
  } else if (!lastBullish && prevBullish) {
    if (lastCandle.open > previousCandle.close && lastCandle.close < previousCandle.open) {
      // Bearish engulfing
      return { score: -10, confidence: 0.05 };
    }
  }
  
  // 4. Detect three white soldiers / three black crows
  if (recent.length >= 3) {
    const thirdLastCandle = recent[recent.length - 3];
    
    // Three white soldiers (bullish)
    if (lastBullish && prevBullish && thirdLastCandle.close > thirdLastCandle.open) {
      if (lastCandle.close > previousCandle.close && previousCandle.close > thirdLastCandle.close) {
        return { score: 10, confidence: 0.05 };
      }
    }
    
    // Three black crows (bearish)
    if (!lastBullish && !prevBullish && thirdLastCandle.close < thirdLastCandle.open) {
      if (lastCandle.close < previousCandle.close && previousCandle.close < thirdLastCandle.close) {
        return { score: -10, confidence: 0.05 };
      }
    }
  }
  
  // No strong pattern detected
  return { score: 0, confidence: 0 };
}

/**
 * Detect price trend
 * @param {Array} candles - Array of candle data
 * @returns {string} Trend direction ('uptrend', 'downtrend', or 'sideways')
 */
function detectTrend(candles) {
  if (candles.length < 10) {
    return 'sideways';
  }
  
  const recentCandles = candles.slice(-10);
  const firstPrice = recentCandles[0].close;
  const lastPrice = recentCandles[recentCandles.length - 1].close;
  
  const priceChange = (lastPrice - firstPrice) / firstPrice * 100;
  
  if (priceChange > 2) {
    return 'uptrend';
  } else if (priceChange < -2) {
    return 'downtrend';
  } else {
    return 'sideways';
  }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getAIPrediction,
    getPatternBasedPrediction,
    detectCandlestickPatterns,
    detectTrend
  };
}
