/**
 * Technical Indicators for Quotex AI Trading Signals
 * 
 * This module implements various technical indicators used for generating trading signals:
 * - Exponential Moving Average (EMA)
 * - Moving Average Convergence Divergence (MACD)
 * - Relative Strength Index (RSI)
 * - Bollinger Bands (BB)
 * - Volume Analysis
 */

/**
 * Calculate all technical indicators for a given candle dataset
 * @param {Array} candles - Array of candle data objects
 * @returns {Object} Object containing all calculated indicators
 */
function calculateAllIndicators(candles) {
  if (!candles || candles.length < 30) {
    console.warn('Not enough candle data for indicator calculation');
    return getEmptyIndicators();
  }
  
  try {
    // Extract close prices and volumes
    const closes = candles.map(candle => candle.close);
    const volumes = candles.map(candle => candle.volume || 0);
    
    // Calculate indicators
    const ema = calculateEMA(closes);
    const macd = calculateMACD(closes);
    const rsi = calculateRSI(closes);
    const bb = calculateBollingerBands(closes);
    const volume = analyzeVolume(volumes, closes);
    
    return {
      ema,
      macd,
      rsi,
      bb,
      volume
    };
  } catch (error) {
    console.error('Error calculating indicators:', error);
    return getEmptyIndicators();
  }
}

/**
 * Get empty indicator values for when calculation fails
 * @returns {Object} Object with default empty indicator values
 */
function getEmptyIndicators() {
  return {
    ema: { ema20: 0, ema50: 0, crossover: 'none' },
    macd: { line: 0, signal: 0, histogram: 0, previousHistogram: 0 },
    rsi: { value: 50 },
    bb: { upper: 0, middle: 0, lower: 0, width: 0, position: 'middle' },
    volume: { current: 0, average: 0, trend: 'stable' }
  };
}

/**
 * Calculate Exponential Moving Average (EMA)
 * @param {Array} prices - Array of price values
 * @returns {Object} EMA values and crossover status
 */
function calculateEMA(prices) {
  try {
    // Calculate EMA 20
    const ema20 = getEMA(prices, 20);
    
    // Calculate EMA 50
    const ema50 = getEMA(prices, 50);
    
    // Determine crossover
    let crossover = 'none';
    
    if (prices.length >= 52) {
      const currentEma20 = ema20[ema20.length - 1];
      const currentEma50 = ema50[ema50.length - 1];
      
      const previousEma20 = ema20[ema20.length - 2];
      const previousEma50 = ema50[ema50.length - 2];
      
      if (previousEma20 <= previousEma50 && currentEma20 > currentEma50) {
        crossover = 'bullish';
      } else if (previousEma20 >= previousEma50 && currentEma20 < currentEma50) {
        crossover = 'bearish';
      }
    }
    
    return {
      ema20: ema20[ema20.length - 1],
      ema50: ema50[ema50.length - 1],
      crossover
    };
  } catch (error) {
    console.error('Error calculating EMA:', error);
    return { ema20: 0, ema50: 0, crossover: 'none' };
  }
}

/**
 * Get EMA for a specific period
 * @param {Array} prices - Array of price values
 * @param {number} period - EMA period
 * @returns {Array} EMA values
 */
function getEMA(prices, period) {
  if (prices.length < period) {
    return prices.map(() => 0);
  }
  
  // Calculate initial SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  
  const sma = sum / period;
  const multiplier = 2 / (period + 1);
  
  // Calculate EMA
  const emaValues = Array(period - 1).fill(0);
  emaValues.push(sma);
  
  for (let i = period; i < prices.length; i++) {
    const ema = (prices[i] - emaValues[emaValues.length - 1]) * multiplier + emaValues[emaValues.length - 1];
    emaValues.push(ema);
  }
  
  return emaValues;
}

/**
 * Calculate Moving Average Convergence Divergence (MACD)
 * @param {Array} prices - Array of price values
 * @returns {Object} MACD values
 */
function calculateMACD(prices) {
  try {
    if (prices.length < 26) {
      return { line: 0, signal: 0, histogram: 0, previousHistogram: 0 };
    }
    
    // Calculate 12-day EMA
    const ema12 = getEMA(prices, 12);
    
    // Calculate 26-day EMA
    const ema26 = getEMA(prices, 26);
    
    // Calculate MACD line (12-day EMA - 26-day EMA)
    const macdLine = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < 25) {
        macdLine.push(0);
      } else {
        macdLine.push(ema12[i] - ema26[i]);
      }
    }
    
    // Calculate signal line (9-day EMA of MACD line)
    const signalLine = getEMA(macdLine, 9);
    
    // Calculate histogram (MACD line - signal line)
    const histogram = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < 33) {
        histogram.push(0);
      } else {
        histogram.push(macdLine[i] - signalLine[i]);
      }
    }
    
    return {
      line: macdLine[macdLine.length - 1],
      signal: signalLine[signalLine.length - 1],
      histogram: histogram[histogram.length - 1],
      previousHistogram: histogram[histogram.length - 2] || 0
    };
  } catch (error) {
    console.error('Error calculating MACD:', error);
    return { line: 0, signal: 0, histogram: 0, previousHistogram: 0 };
  }
}

/**
 * Calculate Relative Strength Index (RSI)
 * @param {Array} prices - Array of price values
 * @param {number} period - RSI period (default: 14)
 * @returns {Object} RSI value
 */
function calculateRSI(prices, period = 14) {
  try {
    if (prices.length < period + 1) {
      return { value: 50 };
    }
    
    // Calculate price changes
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    
    // Calculate gains and losses
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);
    
    // Calculate average gains and losses
    let avgGain = 0;
    let avgLoss = 0;
    
    for (let i = 0; i < period; i++) {
      avgGain += gains[i];
      avgLoss += losses[i];
    }
    
    avgGain /= period;
    avgLoss /= period;
    
    // Calculate subsequent values
    for (let i = period; i < changes.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    }
    
    // Calculate RS and RSI
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return { value: rsi };
  } catch (error) {
    console.error('Error calculating RSI:', error);
    return { value: 50 };
  }
}

/**
 * Calculate Bollinger Bands
 * @param {Array} prices - Array of price values
 * @param {number} period - Period for SMA (default: 20)
 * @param {number} multiplier - Standard deviation multiplier (default: 2)
 * @returns {Object} Bollinger Bands values
 */
function calculateBollingerBands(prices, period = 20, multiplier = 2) {
  try {
    if (prices.length < period) {
      return { upper: 0, middle: 0, lower: 0, width: 0, position: 'middle' };
    }
    
    // Calculate SMA
    const sma = [];
    for (let i = period - 1; i < prices.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - j];
      }
      sma.push(sum / period);
    }
    
    // Calculate standard deviation
    const stdDev = [];
    for (let i = period - 1; i < prices.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += Math.pow(prices[i - j] - sma[i - (period - 1)], 2);
      }
      stdDev.push(Math.sqrt(sum / period));
    }
    
    // Calculate upper and lower bands
    const upperBand = [];
    const lowerBand = [];
    for (let i = 0; i < sma.length; i++) {
      upperBand.push(sma[i] + (multiplier * stdDev[i]));
      lowerBand.push(sma[i] - (multiplier * stdDev[i]));
    }
    
    // Get latest values
    const currentSMA = sma[sma.length - 1];
    const currentUpper = upperBand[upperBand.length - 1];
    const currentLower = lowerBand[lowerBand.length - 1];
    const currentPrice = prices[prices.length - 1];
    
    // Calculate bandwidth
    const width = (currentUpper - currentLower) / currentSMA;
    
    // Determine price position relative to bands
    let position = 'middle';
    if (currentPrice >= currentUpper) {
      position = 'upper';
    } else if (currentPrice <= currentLower) {
      position = 'lower';
    }
    
    return {
      upper: currentUpper,
      middle: currentSMA,
      lower: currentLower,
      width,
      position
    };
  } catch (error) {
    console.error('Error calculating Bollinger Bands:', error);
    return { upper: 0, middle: 0, lower: 0, width: 0, position: 'middle' };
  }
}

/**
 * Analyze volume
 * @param {Array} volumes - Array of volume values
 * @param {Array} prices - Array of price values
 * @returns {Object} Volume analysis
 */
function analyzeVolume(volumes, prices) {
  try {
    if (volumes.length < 10) {
      return { current: 0, average: 0, trend: 'stable' };
    }
    
    // Calculate average volume over the last 10 periods
    let sum = 0;
    for (let i = volumes.length - 10; i < volumes.length; i++) {
      sum += volumes[i];
    }
    const avgVolume = sum / 10;
    
    // Get current volume
    const currentVolume = volumes[volumes.length - 1];
    
    // Determine volume trend
    let trend = 'stable';
    if (currentVolume > avgVolume * 1.5) {
      // Check if price is increasing or decreasing
      const priceChange = prices[prices.length - 1] - prices[prices.length - 2];
      
      if (priceChange > 0) {
        trend = 'increasing';
      } else if (priceChange < 0) {
        trend = 'decreasing';
      } else {
        trend = 'high';
      }
    } else if (currentVolume < avgVolume * 0.5) {
      trend = 'low';
    }
    
    return {
      current: currentVolume,
      average: avgVolume,
      trend
    };
  } catch (error) {
    console.error('Error analyzing volume:', error);
    return { current: 0, average: 0, trend: 'stable' };
  }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateAllIndicators,
    calculateEMA,
    calculateMACD,
    calculateRSI,
    calculateBollingerBands,
    analyzeVolume
  };
}
