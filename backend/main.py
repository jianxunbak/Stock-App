from fastapi import FastAPI, HTTPException
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
import os
import requests
import json
from dotenv import load_dotenv
import pathlib
import time
from datetime import datetime, timedelta, timezone
import firebase_admin
from firebase_admin import credentials, firestore

# Load .env from the project root (one level up from backend/)
env_path = pathlib.Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Set cache directory for Vercel (read-only file system fix)
if os.environ.get('VERCEL'):
    os.environ['XDG_CACHE_HOME'] = '/tmp'

MAJOR_SECTORS = [
    "Technology", "Healthcare", "Financial Services", "Consumer Cyclical", 
    "Consumer Defensive", "Industrials", "Communication Services", 
    "Energy", "Utilities", "Real Estate", "Basic Materials"
]

def calculate_manual_beta(ticker_symbol):
    """
    Calculates a 1-year manual Beta by comparing the ticker's daily returns 
    to the S&P 500 (^GSPC).
    """
    try:
        print(f"DEBUG: Calculating 1-year manual beta for {ticker_symbol}...")
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        
        # Use a fresh Ticker object to avoid any session issues
        ticker_obj = yf.Ticker(ticker_symbol)
        market_obj = yf.Ticker("^GSPC")
        
        # Fetch 1 year of daily data
        t_hist = ticker_obj.history(start=start_date, end=end_date)['Close']
        m_hist = market_obj.history(start=start_date, end=end_date)['Close']
        
        if t_hist.empty or m_hist.empty:
            print("DEBUG: History empty for manual beta calculation")
            return 1.0
            
        # Align dates and calculate daily returns
        df = pd.concat([t_hist, m_hist], axis=1, keys=['ticker', 'market']).dropna()
        if len(df) < 20:
            print("DEBUG: Not enough aligned data for manual beta calculation")
            return 1.0
            
        returns = df.pct_change().dropna()
        
        covariance = returns['ticker'].cov(returns['market'])
        variance = returns['market'].var()
        
        if variance == 0:
            return 1.0
            
        manual_beta = covariance / variance
        print(f"DEBUG: Manual beta calculated: {manual_beta:.4f}")
        return manual_beta
    except Exception as e:
        print(f"Error calculating manual beta: {e}")
        return 1.0

def get_forex_rate(target_currency: str, base_currency: str = "USD"):
    """
    Fetches the live exchange rate from Base -> Target.
    Uses Frankfurter API first, falls back to yfinance.
    """
    # 1. Try Frankfurter API (Free, no key)
    # URL: https://api.frankfurter.app/latest?from=USD&to=SGD
    try:
        url = f"https://api.frankfurter.app/latest?from={base_currency}&to={target_currency}"
        print(f"DEBUG: Fetching forex rate from {url}")
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            rate = data.get("rates", {}).get(target_currency)
            if rate:
                print(f"DEBUG: Frankfurter rate for {base_currency}->{target_currency}: {rate}")
                return float(rate)
    except Exception as e:
        print(f"WARNING: Frankfurter API failed: {e}")

    # 2. Fallback to yfinance
    # Ticker format: "USDSGD=X"
    try:
        ticker = f"{base_currency}{target_currency}=X"
        print(f"DEBUG: Fetching fallback forex rate from yfinance ({ticker})")
        df = yf.download(ticker, period="1d", interval="1d", progress=False)
        if not df.empty:
            # yfinance returns a DataFrame, get the last 'Close'
            rate = df['Close'].iloc[-1]
            if isinstance(rate, pd.Series):
                 rate = rate.iloc[0] # handle if multi-index or series
            
            # Additional check for numpy scalar
            if hasattr(rate, "item"):
                rate = rate.item()
                
            print(f"DEBUG: yfinance rate for {ticker}: {rate}")
            return float(rate)
    except Exception as e:
        print(f"ERROR: yfinance forex fallback failed: {e}")

    # 3. Final Fallback (Approximate Consts if everything fails)
    fallbacks = {
        "SGD": 1.35,
        "EUR": 0.92,
        "GBP": 0.79,
        "CNY": 7.20
    }
    return fallbacks.get(target_currency, 1.0)


app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# --- Firebase Initialization ---
db = None
try:
    # 1. Check if a local service account file exists (Dev Mode)
    cred_path = pathlib.Path(__file__).parent / 'serviceAccountKey.json'
    
    if cred_path.exists():
        cred = credentials.Certificate(str(cred_path))
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("SUCCESS: Firebase Admin Initialized with serviceAccountKey.json")
    
    # 2. Check for Environment Variable (Deployment Mode)
    elif os.environ.get("FIREBASE_SERVICE_ACCOUNT"):
        print("INFO: Found FIREBASE_SERVICE_ACCOUNT env var.")
        try:
            # Parse the JSON string
            service_account_info = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
            cred = credentials.Certificate(service_account_info)
            firebase_admin.initialize_app(cred)
            db = firestore.client()
            print("SUCCESS: Firebase Admin Initialized via FIREBASE_SERVICE_ACCOUNT env var")
        except Exception as env_e:
            print(f"ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT: {env_e}")
            
    else:
        # 3. Try default google credentials (Good for GCP/Cloud Run)
        try:
            firebase_admin.initialize_app()
            db = firestore.client()
            print("SUCCESS: Firebase Admin Initialized with Default Cloud Credentials")
        except:
            print("WARNING: No Firebase credentials found (File or Env). Caching will be disabled.")
            db = None

except Exception as e:
    print(f"WARNING: Firebase Init Failed: {e}")
    db = None

# def get_validated_support_levels(ticker: str):
#     try:
#         s_start = time.time()
#         stock = yf.Ticker(ticker)
        
#         # 1. Fetch Data - Combine into fewer requests if possible, but intervals vary
#         hist_5y_wk = stock.history(period="5y", interval="1wk")
#         hist_1y_d = stock.history(period="1y", interval="1d")
        
#         if hist_1y_d.empty:
#             return []
            
#         current_price = hist_1y_d['Close'].iloc[-1]
#         support_candidates = []

#         # --- Logic 1: The "Bounce" Test (SMAs) ---
#         timeframes = [
#             ("Weekly", hist_5y_wk),
#             ("Daily", hist_1y_d)
#         ]
        
#         sma_periods = [50, 100, 150, 200]
        
#         for tf_name, df in timeframes:
#             if len(df) < 50: continue # Need at least some data
            
#             for period in sma_periods:
#                 if len(df) < period: continue
                
#                 sma_col = f"SMA_{period}"
#                 df[sma_col] = df['Close'].rolling(window=period).mean()
                
#                 # Vectorized Bounce Calculation
#                 # Condition: Low comes within 1% of SMA, and Close finishes above SMA
#                 bounces = (df['Low'] <= df[sma_col] * 1.01) & (df['Close'] >= df[sma_col] * 0.99)
#                 bounce_count = bounces.sum()
                
#                 if bounce_count >= 3:
#                     current_sma = df[sma_col].iloc[-1]
#                     if not pd.isna(current_sma) and current_sma < current_price:
#                         support_candidates.append({
#                             "price": current_sma,
#                             "source": f"{tf_name}",
#                             "reason": f"{tf_name} {period} SMA - {bounce_count} touches",
#                             "score": float(bounce_count) * 2
#                         })

#         # --- Logic 2: Horizontal Clusters (Swing Lows) ---
#         def get_swing_lows_vectorized(df, window=5):
#             if len(df) < window * 2 + 1: return []
#             # Find local minima in a rolling window
#             is_min = df['Low'] == df['Low'].rolling(window=window*2+1, center=True).min()
#             return df[is_min]['Low'].tolist()

#         swing_lows = []
#         swing_lows.extend(get_swing_lows_vectorized(hist_5y_wk, window=5)) 
#         swing_lows.extend(get_swing_lows_vectorized(hist_1y_d, window=3)) 
        
#         swing_lows.sort()
        
#         # Cluster lows within 2%
#         clusters = []
#         if swing_lows:
#             current_cluster = [swing_lows[0]]
            
#             for i in range(1, len(swing_lows)):
#                 price = swing_lows[i]
#                 avg_cluster = sum(current_cluster) / len(current_cluster)
                
#                 if abs(price - avg_cluster) / avg_cluster <= 0.02:
#                     current_cluster.append(price)
#                 else:
#                     if len(current_cluster) >= 2:
#                         avg_price = sum(current_cluster) / len(current_cluster)
#                         if avg_price < current_price:
#                             clusters.append({"price": avg_price, "count": len(current_cluster)})
#                     current_cluster = [price]
            
#             if len(current_cluster) >= 2:
#                 avg_price = sum(current_cluster) / len(current_cluster)
#                 if avg_price < current_price:
#                     clusters.append({"price": avg_price, "count": len(current_cluster)})

#         for c in clusters:
#             support_candidates.append({
#                 "price": c['price'],
#                 "source": "Price Action",
#                 "reason": f"Historical Support - {c['count']} confirmation points",
#                 "score": float(c['count']) * 1.5
#             })

#         print(f"DEBUG: Support levels calculated in {time.time() - s_start:.2f}s")

#         # --- Final Selection ---
#         # Sort by Score (Validation Strength) first, then closeness?
#         # User asked: "sorted by closeness to the current price"
#         # But we should prioritize "Validated" levels.
#         # Let's sort by Price Descending (Closeness to current price, assuming support is below)
        
#         # Deduplicate (merge close levels)
#         support_candidates.sort(key=lambda x: x['price'], reverse=True)
#         unique_levels = []
        
#         if support_candidates:
#             current_level = support_candidates[0]
#             merged_group = [current_level]
            
#             for i in range(1, len(support_candidates)):
#                 next_level = support_candidates[i]
#                 if abs(current_level['price'] - next_level['price']) / current_level['price'] <= 0.015:
#                     merged_group.append(next_level)
#                     # Keep the one with highest score as the "main" reason
#                     if next_level['score'] > current_level['score']:
#                         current_level = next_level
#                 else:
#                     unique_levels.append(current_level)
#                     current_level = next_level
#                     merged_group = [current_level]
#             unique_levels.append(current_level)

#         return unique_levels[:5]

#     except Exception as e:
#         print(f"Error in get_validated_support_levels: {e}")
#         return []

def get_validated_support_levels(ticker: str):
    try:
        s_start = time.time()
        stock = yf.Ticker(ticker)
        
        # Fetching data
        hist_5y_wk = stock.history(period="5y", interval="1wk")
        hist_1y_d = stock.history(period="1y", interval="1d")
        
        if hist_1y_d.empty:
            return []
            
        current_price = hist_1y_d['Close'].iloc[-1]
        support_candidates = []

        # --- Logic 1: Improved SMA "Touch" Logic ---
        timeframes = [("Weekly", hist_5y_wk), ("Daily", hist_1y_d)]
        sma_periods = [50, 100, 200] # Focus on the most respected ones
        
        for tf_name, df in timeframes:
            if len(df) < 50: continue
            
            for period in sma_periods:
                if len(df) < period: continue
                
                sma_col = f"SMA_{period}"
                df[sma_col] = df['Close'].rolling(window=period).mean()
                
                # Check for "Touches": Low gets near the SMA, and Close is above it.
                # Increased buffer to 1.5% and ensured the trend is supportive.
                touches = (df['Low'] <= df[sma_col] * 1.015) & (df['Close'] > df[sma_col])
                touch_count = touches.sum()
                
                if touch_count >= 2: # 2 touches on a major SMA is significant
                    current_sma = df[sma_col].iloc[-1]
                    # Only include if current price is above the SMA (making it support)
                    if not pd.isna(current_sma) and current_sma < current_price:
                        # Proximity weight: levels closer to current price get a slight boost
                        proximity = 1 - (abs(current_price - current_sma) / current_price)
                        support_candidates.append({
                            "price": float(current_sma),
                            "source": f"{tf_name} SMA",
                            "reason": f"{tf_name} {period} SMA - {touch_count} touches",
                            "score": float(touch_count) * 2.5 * proximity
                        })

        # --- Logic 2: Swing Lows (Fractals) ---
        def get_swing_lows(df, window=5):
            lows = []
            for i in range(window, len(df) - window):
                # Check if current low is lower than 'window' bars before and after
                if all(df['Low'].iloc[i] <= df['Low'].iloc[i-window:i]) and \
                   all(df['Low'].iloc[i] <= df['Low'].iloc[i+1:i+window+1]):
                    lows.append(df['Low'].iloc[i])
            return lows

        # Use wider windows for cleaner levels
        sl = get_swing_lows(hist_5y_wk, window=10) # Major multi-year lows
        sl.extend(get_swing_lows(hist_1y_d, window=14)) # Solid daily lows
        sl.sort()
        
        # --- Logic 3: Dynamic Clustering (The "Zone" Approach) ---
        clusters = []
        if sl:
            current_cluster = [sl[0]]
            for i in range(1, len(sl)):
                # Use a slightly wider 3% threshold for historical "zones"
                if (sl[i] - (sum(current_cluster)/len(current_cluster))) / (sum(current_cluster)/len(current_cluster)) <= 0.03:
                    current_cluster.append(sl[i])
                else:
                    avg_price = sum(current_cluster) / len(current_cluster)
                    if avg_price < current_price:
                        clusters.append({"price": avg_price, "count": len(current_cluster)})
                    current_cluster = [sl[i]]
            # Final cluster check
            avg_price = sum(current_cluster) / len(current_cluster)
            if avg_price < current_price:
                clusters.append({"price": avg_price, "count": len(current_cluster)})

        for c in clusters:
            # Score based on number of lows in that zone
            support_candidates.append({
                "price": float(c['price']),
                "source": "Price Action",
                "reason": f"Historical Support Zone ({c['count']} points)",
                "score": float(c['count']) * 2.0
            })

        # --- Final Selection & Deduplication ---
        # 1. Sort by price (highest to lowest, i.e., closest to current price first)
        support_candidates.sort(key=lambda x: x['price'], reverse=True)
        
        unique_levels = []
        if support_candidates:
            unique_levels.append(support_candidates[0])
            for i in range(1, len(support_candidates)):
                # Merge levels within 2% of each other to avoid clutter
                is_duplicate = False
                for ul in unique_levels:
                    if abs(support_candidates[i]['price'] - ul['price']) / ul['price'] < 0.025:
                        # Keep the one with the higher score
                        if support_candidates[i]['score'] > ul['score']:
                            ul.update(support_candidates[i])
                        is_duplicate = True
                        break
                if not is_duplicate:
                    unique_levels.append(support_candidates[i])

        return unique_levels[:5]

    except Exception as e:
        print(f"Error in support calculation: {e}")
        return []

def get_next_5y_growth(stock_obj, ticker, info):
    """
    Enhanced growth estimation. 
    1. ETF -> fiveYearAverageReturn
    2. Stock -> Scrape Yahoo Finance Analysis tab (Priority)
    3. Stock -> info lookup (earningsGrowth, revenueGrowth) (Fallback)
    """
    quote_type = info.get("quoteType")
    
    # 1. ETF Logic
    if quote_type == "ETF":
        val = info.get("fiveYearAverageReturn")
        if val is not None:
            return float(val), "Note: ETFs use historical 5Y average return rather than analyst projections."
        return 0.05, "Note: ETF growth default (5%) used as 5Y average return was missing."

    # 2. Scraping Yahoo Finance "Analysis" Tab (Priority for Stocks)
    # This matches "Next 5 Years (per annum)" which is what we want.
    try:
        url = f"https://finance.yahoo.com/quote/{ticker}/analysis"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        tables = pd.read_html(response.text)
        
        for table in tables:
            # Look for "Growth Estimates" table
            if any("Growth Estimates" in str(col) for col in table.columns) or \
               any("Next 5 Years (per annum)" in str(row) for row in table.values):
                
                # Search rows
                for i, row in table.iterrows():
                    row_label = str(row[0])
                    if "Next 5 Years (per annum)" in row_label:
                        val_str = str(row[1]).replace("%", "").replace(",", "")
                        if val_str and val_str.lower() != 'nan' and val_str != 'N/A':
                            return float(val_str) / 100.0, "" # Success
    except Exception as e:
        print(f"Scraping fallback failed for {ticker}: {e}")

    # 3. Stock Info Lookup (Fallback)
    # This often returns TTM growth which can be misleading (e.g. 90% jump), so we label it.
    # CRITICAL FIX: Do not use negative estimates for long term growth projections.
    eg = info.get("earningsGrowth")
    rg = info.get("revenueGrowth")
    
    if eg is not None and eg > 0.01:
        return float(eg), "Note: Used current TTM Earnings Growth (long-term est. unavailable)."
        
    if rg is not None and rg > 0.01:
         return float(rg), "Note: Used current TTM Revenue Growth (long-term est. unavailable)."

    # 4. Final Fallback (Historical or Default)
    return 0.05, "Note: Default growth (5%) used as no projections or growth metrics were found."

def calculate_intrinsic_value(ticker, info, financials, balance_sheet, cashflow, 
                              revenue_series, net_income_series, op_cash_flow_series, 
                              growth_estimates, beta=None, raw_growth_estimates_data=None,
                              revenue_estimates_data=None, history=None, stock_obj=None):
    try:
        # --- 1. Determine Method ---
        sector = info.get("sector", "")
        industry = info.get("industry", "")
        country = info.get("country", "United States")
        
        is_financial = "Financial" in sector or "Bank" in industry or "Insurance" in industry
        
        # Check Consistency (Reuse logic or simple check)
        def is_consistent(series):
            if len(series) < 3: return False
            # Check if generally increasing (allow one dip)
            increases = 0
            for i in range(len(series)-1):
                if series.iloc[i] >= series.iloc[i+1] * 0.9: # series is desc, so i is newer. newer >= older
                    increases += 1
            return increases >= len(series) - 2

        rev_consistent = is_consistent(revenue_series)
        ni_consistent = is_consistent(net_income_series)
        ocf_consistent = is_consistent(op_cash_flow_series)
        
        # Speculative Check: High Rev Growth (>15%) but Negative NI or OCF
        rev_cagr = 0
        if len(revenue_series) >= 3:
            rev_cagr = (revenue_series.iloc[0] / revenue_series.iloc[-1])**(1/len(revenue_series)) - 1
        
        current_ni = net_income_series.iloc[0] if not net_income_series.empty else 0
        current_ocf = op_cash_flow_series.iloc[0] if not op_cash_flow_series.empty else 0
        
        is_speculative = (rev_cagr > 0.15) and (current_ni < 0 or current_ocf < 0) and not is_financial

        method = "Discounted Free Cash Flow (DFCF)" # Default
        
        if is_financial:
            method = "Mean Price-to-Book (PB)"
        elif is_speculative:
            method = "Price to Sales Growth (PSG)"
        else:
            if rev_consistent and ni_consistent and ocf_consistent:
                if current_ocf > 1.5 * current_ni:
                    method = "Discounted Free Cash Flow (DFCF)"
                else:
                    method = "Discounted Operating Cash Flow (DOCF)"
            elif rev_consistent and ni_consistent:
                method = "Discounted Net Income (DNI)"
            else:
                method = "Discounted Free Cash Flow (DFCF)" # Fallback

        # --- 2. Assumptions ---
        current_price = info.get("currentPrice") or info.get("regularMarketPrice") or 0
        shares_outstanding = info.get("sharesOutstanding") or info.get("impliedSharesOutstanding") or 1
        
        if not current_price or not shares_outstanding:
            return {
                "status": "Error", 
                "intrinsicValue": 0, 
                "currentPrice": current_price,
                "differencePercent": 0, 
                "method": "N/A", 
                "assumptions": {},
                "growthRateNext5Y": None,
                "growthNote": "Error: Missing price or share data"
            }
        
        # 1. Use the new enhanced growth helper
        enhanced_growth, growth_note = get_next_5y_growth(stock_obj, ticker, info)

        # Discount Rate (WACC / Cost of Equity)
        # Simplified based on Beta and Risk Free Rate (approx 4%) + Risk Premium (5%)
        # Or lookup table based on Beta/Country
        def get_discount_rate(beta, country):
            # Base rates
            risk_free = 0.04
            erp = 0.05 # Equity Risk Premium
            
            if "China" in country:
                # Higher risk
                # Map beta to discount rate table provided by user previously
                # < 0.8: 8.5%, 0.8-0.9: 9.3%, etc.
                if beta < 0.8: return 0.08
                if beta < 1.0: return 0.09
                if beta < 1.2: return 0.10
                return 0.11
                
            else: # US / Default
                if beta < 0.80: return 0.054
                
                if beta < 0.85: return 0.054 # < 0.8
                if beta < 0.95: return 0.057 # ~0.9
                if beta < 1.05: return 0.060 # ~1.0
                if beta < 1.15: return 0.063 # ~1.1
                if beta < 1.25: return 0.066 # ~1.2
                if beta < 1.35: return 0.069 # ~1.3
                if beta < 1.45: return 0.072 # ~1.4
                if beta < 1.55: return 0.075 # ~1.5
                return 0.078 # > 1.5 (Assuming typo in user prompt, following progression)

        beta_val = beta if beta else 1.0
        discount_rate = get_discount_rate(beta_val, country)
        
        # Growth Rate (Yr 1-5)
        # Use our enhanced logic as the primary driver for growth_rate_1_5
        growth_rate_1_5 = enhanced_growth
        
        # We still cap it for safety in DCF
        growth_rate_1_5 = min(max(growth_rate_1_5, -0.10), 0.35) # Expanded upper cap slightly to 35%
        
        # Growth Rate (Yr 6-10) - Same but capped at 15%
        growth_rate_6_10 = min(growth_rate_1_5, 0.15)
        
        # Growth Rate (Yr 11-20) - 4% US, 6% China
        growth_rate_11_20 = 0.06 if "China" in country else 0.04

        # Balance Sheet Items
        total_debt = 0
        cash_and_equivalents = 0
        if not balance_sheet.empty:
            if "Total Debt" in balance_sheet.index:
                total_debt = balance_sheet.loc["Total Debt"].iloc[0]
            if "Cash And Cash Equivalents" in balance_sheet.index:
                cash_and_equivalents = balance_sheet.loc["Cash And Cash Equivalents"].iloc[0]
            elif "Cash Cash Equivalents And Short Term Investments" in balance_sheet.index:
                cash_and_equivalents = balance_sheet.loc["Cash Cash Equivalents And Short Term Investments"].iloc[0]

        # --- 3. Calculate ---
        intrinsic_value = 0
        assumptions = {}
        
        if method == "Mean Price-to-Book (PB)":
            # Inputs: Current BVPS, Historical PB
            book_value = info.get("bookValue")
            if not book_value and not balance_sheet.empty:
                 equity = balance_sheet.loc["Stockholders Equity"].iloc[0] if "Stockholders Equity" in balance_sheet.index else 0
                 book_value = equity / shares_outstanding
            
            # Calculate Historical PB
            historical_pbs = []
            if not balance_sheet.empty and not financials.empty and history is not None and not history.empty:
                try:
                    # Get Equity
                    equity_series = None
                    if "Stockholders Equity" in balance_sheet.index:
                        equity_series = balance_sheet.loc["Stockholders Equity"]
                    
                    # Get Shares
                    shares_series = None
                    if "Basic Average Shares" in financials.index:
                        shares_series = financials.loc["Basic Average Shares"]
                    elif "Diluted Average Shares" in financials.index:
                        shares_series = financials.loc["Diluted Average Shares"]
                    
                    if equity_series is not None and shares_series is not None:
                        # Calculate BVPS for each period
                        # Align indices (dates)
                        common_dates = equity_series.index.intersection(shares_series.index)
                        for date in common_dates:
                            eq = equity_series.loc[date]
                            sh = shares_series.loc[date]
                            if sh > 0:
                                bvps = eq / sh
                                # Find price
                                # history index is DatetimeIndex (tz-aware usually), date is Timestamp (tz-naive usually)
                                ts = pd.Timestamp(date)
                                if ts.tz is None:
                                    ts = ts.tz_localize("UTC")
                                
                                # Convert to history tz
                                if history.index.tz is not None:
                                    ts = ts.tz_convert(history.index.tz)
                                else:
                                    ts = ts.tz_localize(None) # Make naive if history is naive
                                
                                # Find closest price (on or before)
                                idx = history.index.get_indexer([ts], method='pad')[0]
                                if idx != -1:
                                    price = history.iloc[idx]['Close']
                                    if bvps > 0:
                                        pb = price / bvps
                                        historical_pbs.append(pb)
                except Exception as e:
                    print(f"Error calculating historical PB: {e}")

            # Calculate Mean PB
            mean_pb = 1.5 # Default fallback
            current_pb = info.get("priceToBook")
            
            if historical_pbs:
                # Filter outliers?
                valid_pbs = [pb for pb in historical_pbs if 0 < pb < 100] # Simple filter
                if valid_pbs:
                    mean_pb = sum(valid_pbs) / len(valid_pbs)
                elif current_pb:
                     mean_pb = current_pb
            elif current_pb:
                mean_pb = current_pb
            
            intrinsic_value = book_value * mean_pb
            assumptions = {
                "Current Book Value Per Share": f"${book_value:.2f}",
                "Mean PB Ratio": f"{mean_pb:.2f}",
                "Growth Note": growth_note
            }
            # No early return here anymore

        elif method == "Price to Sales Growth (PSG)":
            # Intrinsic Value = Sales Per Share * Projected Growth Rate * 0.20
            
            # 1. Sales Per Share (TTM)
            sales_per_share = info.get("revenuePerShare")
            if not sales_per_share:
                # Fallback to manual calculation
                sales_per_share = (revenue_series.iloc[0] / shares_outstanding) if not revenue_series.empty else 0
            
            # 2. Projected Growth Rate (Sales growth (year/est))
            growth_rate_whole = growth_rate_1_5 * 100 # Default fallback
            
            if revenue_estimates_data:
                # Look for period "+1y" and "growth" column
                for row in revenue_estimates_data:
                    if row.get("period") == "+1y":
                        val = row.get("growth")
                        if val is not None:
                            try:
                                growth_rate_whole = float(val) * 100 # Convert decimal to percentage (0.06 -> 6.0)
                            except: pass
                        break

            intrinsic_value = sales_per_share * growth_rate_whole * 0.20
            assumptions = {
                "Sales Per Share (TTM)": f"${sales_per_share:.2f}",
                "Projected Sales Growth": f"{growth_rate_whole:.2f}%",
                "Fair PSG Constant": "0.20",
                "Growth Note": growth_note
            }

        else: # DCF / DOCF / DNI
            # Base Metric
            base_value = 0
            metric_name = ""
            
            if "Free Cash Flow" in method:
                # FCF = OCF - CapEx
                capex = 0
                if "Capital Expenditure" in cashflow.index:
                    capex = abs(cashflow.loc["Capital Expenditure"].iloc[0])
                elif "Capital Expenditures" in cashflow.index:
                    capex = abs(cashflow.loc["Capital Expenditures"].iloc[0])
                
                base_value = current_ocf - capex
                metric_name = "Free Cash Flow"
            elif "Operating Cash Flow" in method:
                base_value = current_ocf
                metric_name = "Operating Cash Flow"
            elif "Net Income" in method:
                base_value = current_ni
                metric_name = "Net Income"
            
            # Projection
            future_values = []
            current_val = base_value
            
            # Yr 1-5
            for i in range(5):
                current_val *= (1 + growth_rate_1_5)
                future_values.append(current_val)
            
            # Yr 6-10
            for i in range(5):
                current_val *= (1 + growth_rate_6_10)
                future_values.append(current_val)
                
            # Yr 11-20
            for i in range(10):
                current_val *= (1 + growth_rate_11_20)
                future_values.append(current_val)
                
            # Discount
            present_value_sum = 0
            for i, val in enumerate(future_values):
                pv = val / ((1 + discount_rate) ** (i + 1))
                present_value_sum += pv
                
            # Equity Value
            equity_value = present_value_sum + cash_and_equivalents - total_debt
            intrinsic_value = equity_value / shares_outstanding
            
            assumptions = {
                f"Current {metric_name}": f"${base_value/1e9:.2f}B",
                "Growth Rate (Yr 1-5)": f"{growth_rate_1_5*100:.2f}%",
                "Growth Note": growth_note,
                "Growth Rate (Yr 6-10)": f"{growth_rate_6_10*100:.2f}%",
                "Growth Rate (Yr 11-20)": f"{growth_rate_11_20*100:.2f}%",
                "Discount Rate": f"{discount_rate*100:.2f}%",
                "Total Debt": f"${total_debt/1e9:.2f}B",
                "Cash & Equivalents": f"${cash_and_equivalents/1e9:.2f}B",
                "Shares Outstanding": f"{shares_outstanding/1e9:.2f}B",
                "Beta": f"{beta_val:.2f}"
            }

        # Finalize
        # Formula: ((Stock Price / Intrinsic Value) - 1) * 100
        # We return the decimal here, frontend handles * 100
        diff_percent = ((current_price / intrinsic_value) - 1) if intrinsic_value and intrinsic_value != 0 else 0
        
        status = "Fairly Valued"
        if diff_percent > 0.15: status = "Overvalued"
        elif diff_percent < -0.15: status = "Undervalued"
        
        # Prepare raw values for frontend conversion
        def clean_numeric(val):
            try:
                import math
                v = float(val)
                if math.isnan(v): return 0
                return v
            except:
                return 0

        raw_base_value = clean_numeric(base_value) if 'base_value' in locals() else 0
        raw_sales_per_share = clean_numeric(sales_per_share) if 'sales_per_share' in locals() else 0
        raw_book_value = clean_numeric(book_value) if 'book_value' in locals() else 0

        return {
            "method": method,
            "intrinsicValue": intrinsic_value,
            "currentPrice": current_price,
            "differencePercent": diff_percent,
            "status": status,
            "assumptions": assumptions,
            "raw_assumptions": {
                "base_value": raw_base_value,
                "total_debt": clean_numeric(total_debt),
                "cash_and_equivalents": clean_numeric(cash_and_equivalents),
                "shares_outstanding": clean_numeric(shares_outstanding),
                "sales_per_share": raw_sales_per_share,
                "book_value": raw_book_value
            },
            "growthRateNext5Y": growth_rate_1_5,
            "growthNote": growth_note
        }

    except Exception as e:
        print(f"Error calculating intrinsic value for {ticker}: {e}")
        return {
            "status": "Error", 
            "intrinsicValue": 0, 
            "currentPrice": info.get("currentPrice") or info.get("regularMarketPrice") or 0,
            "differencePercent": 0, 
            "method": "Error", 
            "assumptions": {},
            "growthRateNext5Y": None,
            "growthNote": f"Exception: {str(e)}"
        }

def get_stock_data(ticker: str):
    try:
        start_time = time.time()
        print(f"\n--- [API] START FETCHING DATA FOR {ticker} ---")
        
        stock = yf.Ticker(ticker)
        info = stock.info
        print(f"DEBUG: yFinance info fetched for {ticker}: {info}")
        print(f"DEBUG: info fetching took {time.time() - start_time:.2f}s")
        
        # Validate if stock exists
        if not info or (info.get("currentPrice") is None and info.get("regularMarketPrice") is None):
            print(f"ERROR: Stock {ticker} not found or no price data")
            raise HTTPException(status_code=404, detail=f"Stock '{ticker}' not found or no data available.")

        
        # Helper to map exchange codes
        def get_exchange_name(exchange_code):
            mapping = {
                "NMS": "NASDAQ",
                "NGM": "NASDAQ",
                "NCM": "NASDAQ",
                "NYQ": "NYSE",
                "ASE": "AMEX",
                "PNK": "OTC",
                "PCX": "NYSE Arca",
                "OPR": "Option",
            }
            return mapping.get(exchange_code, exchange_code)

        # Basic Info
        quote_type = info.get("quoteType", "EQUITY")
        
        # Initialize fundamental variables EARLY to avoid UnboundLocalError
        calendar_data = {}
        news_data = []
        growth_estimates_data = []
        raw_growth_estimates_data = []
        revenue_estimates_data = []
        fund_start = time.time()
        
        overview = {
            "name": info.get("longName"),
            "symbol": info.get("symbol"),
            "price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "change": info.get("regularMarketChange", 0),
            "changePercent": info.get("regularMarketChangePercent", 0),
            "exchange": get_exchange_name(info.get("exchange")),
            "currency": info.get("currency"),
            "sector": info.get("sector") or ("ETF" if quote_type == "ETF" else "Unknown"),
            "industry": info.get("industry") or ("ETF" if quote_type == "ETF" else "Unknown"),
            "description": info.get("longBusinessSummary"),
            "marketCap": info.get("marketCap"),
            "beta": info.get("beta"),
            "peRatio": info.get("trailingPE"),
            "pegRatio": info.get("pegRatio") or info.get("trailingPegRatio"),
            "eps": info.get("trailingEps"),
            "dividendYield": info.get("dividendYield"),
            "quoteType": quote_type,
            "is_etf": quote_type == "ETF"
        }

        # Beta Calculation Fallback
        beta_val = info.get("beta")
        if beta_val is None:
            # Check for beta3Year (common in ETFs)
            beta_val = info.get("beta3Year")
            if beta_val is None:
                # Manual calculation as last resort
                beta_val = calculate_manual_beta(ticker)
        
        # Update overview with final beta value
        overview["beta"] = beta_val

        # Financials for Growth & Profitability (Annual data)
        # For ETFs, skip these as they don't exist and yfinance hangs trying to fetch them.
        f_start = time.time()
        financials = pd.DataFrame()
        balance_sheet = pd.DataFrame()
        cashflow = pd.DataFrame()
        
        if quote_type != "ETF":
            try:
                financials = stock.financials if hasattr(stock, 'financials') else pd.DataFrame()
                balance_sheet = stock.balance_sheet if hasattr(stock, 'balance_sheet') else pd.DataFrame()
                cashflow = stock.cashflow if hasattr(stock, 'cashflow') else pd.DataFrame()
            except Exception:
                pass
        print(f"DEBUG: Financials processed in {time.time() - f_start:.2f}s")
        
        # Fetch TTM (Trailing Twelve Months) data for ratio calculations
        ttm_start = time.time()
        ttm_income = pd.Series()
        ttm_cashflow = pd.Series()
        ttm_balance = pd.Series()

        if quote_type != "ETF":
            try:
                financials_ttm = stock.quarterly_financials
                balance_sheet_ttm = stock.quarterly_balance_sheet
                cashflow_ttm = stock.quarterly_cashflow
                
                # Sum last 4 quarters for TTM income statement and cash flow
                if not financials_ttm.empty and len(financials_ttm.columns) >= 4:
                    ttm_income = financials_ttm.iloc[:, :4].sum(axis=1)
                
                if not cashflow_ttm.empty and len(cashflow_ttm.columns) >= 4:
                    ttm_cashflow = cashflow_ttm.iloc[:, :4].sum(axis=1)
                
                # Use most recent quarter for TTM balance sheet (point in time data)
                if not balance_sheet_ttm.empty:
                    ttm_balance = balance_sheet_ttm.iloc[:, 0]
            except Exception as e:
                print(f"Error fetching TTM data: {e}")
        print(f"DEBUG: TTM data processed in {time.time() - ttm_start:.2f}s")
        

        if quote_type != "ETF":
            try:
                # 1. Calendar
                cal_start = time.time()
                try:
                    calendar_data = stock.calendar
                except Exception as e:
                    print(f"Error fetching calendar: {e}")
                print(f"DEBUG: Calendar fetched in {time.time() - cal_start:.2f}s")
                
                # 2. News
                news_start = time.time()
                try:
                    news_data = stock.news
                except Exception as e:
                    print(f"Error fetching news: {e}")
                print(f"DEBUG: News fetched in {time.time() - news_start:.2f}s")

                # 3. Standard Growth Estimates (for calculation)
                est_start = time.time()
                try:
                    ge = None
                    if hasattr(stock, 'get_growth_estimates'):
                        ge = stock.get_growth_estimates()
                    elif hasattr(stock, 'growth_estimates'):
                        ge = stock.growth_estimates
                    
                    if ge is not None and not ge.empty:
                        ge = ge.reset_index()
                        if 'index' in ge.columns:
                            ge = ge.rename(columns={'index': 'period'})
                        elif 'Growth Estimates' in ge.columns:
                            ge = ge.rename(columns={'Growth Estimates': 'period'})
                        else:
                            # Try to find any column that might be the period
                            for col in ge.columns:
                                if 'period' in col.lower():
                                    ge = ge.rename(columns={col: 'period'})
                                    break
                        growth_estimates_data = ge.to_dict(orient='records')
                    print(f"DEBUG: Standard Growth Est fetched in {time.time() - est_start:.2f}s")
                except Exception as e:
                    print(f"Error fetching standard growth estimates: {e}")

                # 4. Raw Growth Estimates (user detail)
                raw_est_start = time.time()
                try:
                    raw_growth_estimates = stock.get_growth_estimates(as_dict=False)
                    if raw_growth_estimates is not None and not raw_growth_estimates.empty:
                        raw_growth_estimates.index.name = 'period'
                        raw_growth_estimates_data = raw_growth_estimates.reset_index().to_dict(orient='records')
                    print(f"DEBUG: Raw Growth Est fetched in {time.time() - raw_est_start:.2f}s")
                except Exception:
                    pass

                # 5. Revenue Estimates
                rev_start = time.time()
                try:
                    re = stock.revenue_estimate
                    if re is not None and not re.empty:
                        re.index.name = 'period'
                        revenue_estimates_data = re.reset_index().to_dict(orient='records')
                    print(f"DEBUG: Revenue Est fetched in {time.time() - rev_start:.2f}s")
                except Exception:
                    pass
                
            except Exception as e:
                print(f"Error fetching fundamentals: {e}")
        
        print(f"DEBUG: Total fundamentals processed in {time.time() - fund_start:.2f}s")

        print("\n--- YFINANCE DATA DEBUG ---")
        print("INFO KEYS:", info.keys())
        print("\nFINANCIALS (5Y Check):\n", financials.head(5))
        print("\nBALANCE SHEET (5Y Check):\n", balance_sheet.head(5))
        print("\nCASHFLOW (5Y Check):\n", cashflow.head(5))
        print("\nCASHFLOW INDEX:", cashflow.index) # Added to debug OCF
        print("\nCALENDAR:\n", calendar_data)
        print("\nGROWTH ESTIMATES:\n", growth_estimates_data)
        print("---------------------------\n")

        # Helper to get value safely
        def get_val(df, key):
            try:
                return df.loc[key].iloc[0] if key in df.index else 0
            except:
                return 0
        
        def get_val_by_index(df, key, index):
            """Get value from dataframe by row key and column index"""
            try:
                if key in df.index and index < len(df.columns):
                    return df.loc[key].iloc[index]
                return 0
            except:
                return 0
        
        def get_ttm_val(series, key):
            """Get value from TTM series"""
            try:
                return series.loc[key] if key in series.index else 0
            except:
                return 0

        # --- Calculate Financial Ratios using TTM Data ---
        
        # ROE = Net Income / Shareholders' Equity (corrected formula)
        ttm_net_income = get_ttm_val(ttm_income, "Net Income")
        ttm_equity = get_ttm_val(ttm_balance, "Stockholders Equity")
        roe_ttm = (ttm_net_income / ttm_equity) if ttm_equity != 0 else (info.get("returnOnEquity") or 0)
        
        # ROIC = (EBIT * (1 - Tax Rate)) / Invested Capital
        ttm_ebit = get_ttm_val(ttm_income, "EBIT")
        ttm_pretax_income = get_ttm_val(ttm_income, "Pretax Income")
        ttm_tax_provision = get_ttm_val(ttm_income, "Tax Provision")
        tax_rate = (ttm_tax_provision / ttm_pretax_income) if ttm_pretax_income != 0 else 0.21  # Default 21%
        
        ttm_total_debt = get_ttm_val(ttm_balance, "Total Debt")
        invested_capital = ttm_equity + ttm_total_debt
        roic_ttm = ((ttm_ebit * (1 - tax_rate)) / invested_capital) if invested_capital != 0 else 0
        
        # Debt-to-EBITDA = Total Debt / EBITDA
        ttm_ebitda = get_ttm_val(ttm_income, "EBITDA")
        debt_to_ebitda_ttm = (ttm_total_debt / ttm_ebitda) if ttm_ebitda != 0 else (info.get("debtToEbitda") or 0)
        
        # Debt Servicing Ratio = Interest Expense / Operating Cash Flow
        ttm_interest_expense = abs(get_ttm_val(ttm_income, "Interest Expense"))
        ttm_ocf = get_ttm_val(ttm_cashflow, "Operating Cash Flow")
        debt_servicing_ratio_ttm = ((ttm_interest_expense / ttm_ocf) * 100) if ttm_ocf != 0 else 0
        
        # Current Ratio = Total Current Assets / Total Current Liabilities
        ttm_current_assets = get_ttm_val(ttm_balance, "Current Assets")
        ttm_current_liabilities = get_ttm_val(ttm_balance, "Current Liabilities")
        current_ratio_ttm = (ttm_current_assets / ttm_current_liabilities) if ttm_current_liabilities != 0 else 0
        
        # Gearing Ratio = (Total Debt / Total Equity) * 100
        gearing_ratio_ttm = ((ttm_total_debt / ttm_equity) * 100) if ttm_equity != 0 else 0
        
        print(f"\\n--- TTM RATIO CALCULATIONS ---")
        print(f"ROE (TTM): {roe_ttm*100:.2f}%")
        print(f"ROIC (TTM): {roic_ttm*100:.2f}%")
        print(f"Debt-to-EBITDA (TTM): {debt_to_ebitda_ttm:.2f}")
        print(f"Debt Servicing Ratio (TTM): {debt_servicing_ratio_ttm:.2f}%")
        print(f"Current Ratio (TTM): {current_ratio_ttm:.2f}")
        print(f"Gearing Ratio (TTM): {gearing_ratio_ttm:.2f}%")

        print(f"DEBUG: Growth Estimates Data: {growth_estimates_data}")
        print(f"DEBUG: Financials Columns: {financials.columns}")
        print(f"DEBUG: Financials Index: {financials.index}")

        # Growth Logic (Simplified)
        revenue = financials.loc["Total Revenue"] if "Total Revenue" in financials.index else pd.Series()
        revenue_growth = revenue.pct_change(-1).iloc[0] if len(revenue) > 1 else 0
        
        # Create revenue_history for charts
        revenue_history = []
        if not revenue.empty:
            # Sort by date ascending
            rev_sorted = revenue.sort_index()
            revenue_history = [{"date": str(d.date()), "value": v} for d, v in rev_sorted.items()]

        # Profitability Logic
        net_income = get_val(financials, "Net Income")
        total_equity = get_val(balance_sheet, "Stockholders Equity")
        roe = (net_income / total_equity) if total_equity else 0
        
        # Debt Logic
        total_debt = get_val(balance_sheet, "Total Debt")
        ebitda = get_val(financials, "EBITDA")
        debt_to_ebitda = (total_debt / ebitda) if ebitda else 0

        # Historical Data for Charts
        h_start = time.time()
        history = stock.history(period="25y")  # Changed from "max" to speed up validation
        print(f"DEBUG: History (25y) fetched in {time.time() - h_start:.2f}s")
        history_data = [{"date": date.strftime("%Y-%m-%d"), "close": close} for date, close in zip(history.index, history["Close"])]

        # Helper to get series safely
        def get_series(df, key):
            if key in df.index:
                return df.loc[key]
            return pd.Series()

        # Extract Series
        revenue_series = get_series(financials, "Total Revenue")
        net_income_series = get_series(financials, "Net Income")
        op_income_series = get_series(financials, "Operating Income")
        cost_of_revenue_series = get_series(financials, "Cost Of Revenue")
        interest_expense_series = get_series(financials, "Interest Expense")
        tax_provision_series = get_series(financials, "Tax Provision")
        pretax_income_series = get_series(financials, "Pretax Income")
        
        op_cash_flow_series = get_series(cashflow, "Operating Cash Flow")
        if op_cash_flow_series.empty:
             op_cash_flow_series = get_series(cashflow, "Total Cash From Operating Activities")

        accounts_receivable_series = get_series(balance_sheet, "Accounts Receivable")
        if accounts_receivable_series.empty:
            accounts_receivable_series = get_series(balance_sheet, "Net Receivables") # Older yfinance mapping

        # --- Growth Calculations ---
        net_income_growth = net_income_series.pct_change(-1).iloc[0] if len(net_income_series) > 1 else 0
        
        eps_growth = 0
        if "trailingEps" in info and "forwardEps" in info and info["trailingEps"]:
             try:
                 eps_growth = ((info["forwardEps"] - info["trailingEps"]) / abs(info["trailingEps"]))
             except:
                 pass


        # --- Calculations for Tables ---
        
        # Gross Margin: (Total Revenue - Cost of Revenue) / Total Revenue * 100
        gross_margin_series = pd.Series()
        if not revenue_series.empty and not cost_of_revenue_series.empty:
            gross_margin_series = ((revenue_series - cost_of_revenue_series) / revenue_series) * 100

        # Net Profit Margin: (Net Income / Total Revenue) * 100
        net_margin_series = pd.Series()
        if not revenue_series.empty and not net_income_series.empty:
            net_margin_series = (net_income_series / revenue_series) * 100

        # Helper to format series for table (Values + Growth Rate)
        def format_series_table(series, name):
            if series.empty:
                print(f"DEBUG: Series {name} is empty")
                return []
            
            # Limit to 5 years
            series_5y = series.iloc[:5]
            
            # Calculate Growth (YoY) - Note: yfinance data is usually descending (newest first)
            # So pct_change(-1) compares current year to previous year (next index)
            growth_series = series.pct_change(-1) * 100
            
            table_data = []
            for date, value in series_5y.items():
                growth = growth_series.loc[date] if date in growth_series.index else 0
                val = float(value) if not pd.isna(value) else 0
                table_data.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "value": val,
                    "growth": float(growth) if not pd.isna(growth) else 0
                })
            print(f"DEBUG: Formatted {name}: {len(table_data)} rows")
            return table_data

        # --- Advanced Metrics Calculations (Latest) ---
        # ... (rest of code)


        # ROIC: Now using TTM calculated value
        roic = roic_ttm

        # Debt Servicing Ratio: Now using TTM calculated value
        debt_servicing_ratio = debt_servicing_ratio_ttm

        # Debt to EBITDA: Now using TTM calculated value
        debt_to_ebitda = debt_to_ebitda_ttm

        # Current Ratio: Now using TTM calculated value
        current_ratio = current_ratio_ttm

        # Gearing Ratio: Now using TTM calculated value (for all stocks, not just REITs)
        gearing_ratio = gearing_ratio_ttm
        is_reit = False
        industry = info.get("industry", "")
        sector = info.get("sector", "")
        
        if "REIT" in industry or "Real Estate" in sector:
            is_reit = True

        # Helper to format DataFrame for frontend
        def format_df(df, ttm_series=None):
            if df.empty:
                return {"dates": [], "metrics": []}
            
            df_5y = df.iloc[:, :5]
            dates = [d.strftime("%Y-%m-%d") for d in df_5y.columns]
            
            # Prepend TTM if available
            if ttm_series is not None and not ttm_series.empty:
                dates.insert(0, "TTM")
            
            metrics = []
            for index, row in df_5y.iterrows():
                values = row.tolist()
                
                # Prepend TTM value if available
                if ttm_series is not None and not ttm_series.empty:
                    val = 0
                    if index in ttm_series.index:
                        val = ttm_series.loc[index]
                        # Handle numpy types
                        if hasattr(val, "item"):
                            val = val.item()
                    values.insert(0, val)

                metrics.append({
                    "name": str(index),
                    "values": values
                })
            return {"dates": dates, "metrics": metrics}

        # Format Financials
        financials_data = format_df(financials, ttm_income)
        balance_sheet_data = format_df(balance_sheet, ttm_balance)
        cashflow_data = format_df(cashflow, ttm_cashflow)

        # Format Calendar
        # calendar_data is already a dict or empty dict from initialization
        


        # --- New Data Fetching ---
        shares_outstanding = info.get("sharesOutstanding")
        
        # CEO
        company_officers = info.get("companyOfficers", [])
        ceo = "N/A"
        for officer in company_officers:
            if "CEO" in officer.get("title", "").upper():
                ceo = officer.get("name")
                break
        
        # Intraday History (for 1D/5D charts)
        # Note: 1d interval might not be enough for 1D chart, but yfinance 1m/5m has limits.
        # We'll fetch 5d with 15m interval to cover 1D and 5D reasonably well.
        try:
            history_intraday = stock.history(period="5d", interval="15m")
            intraday_data = [{"date": date.strftime("%Y-%m-%d %H:%M"), "close": close} for date, close in zip(history_intraday.index, history_intraday["Close"])]
        except:
            intraday_data = []

        # Calculate SMAs for Daily History
        # history is already fetched as 5y daily
        for period in [50, 100, 150, 200]:
            history[f"SMA_{period}"] = history["Close"].rolling(window=period).mean()
        
        # Update history_data to include SMAs
        history_data = []
        for date, row in history.iterrows():
            item = {
                "date": date.strftime("%Y-%m-%d"),
                "close": row["Close"]
            }
            # Add SMAs if they exist (not NaN)
            for period in [50, 100, 150, 200]:
                val = row[f"SMA_{period}"]
                if not pd.isna(val):
                    item[f"SMA_{period}"] = val
            history_data.append(item)

        # --- Valuation Calculation (needed for scoring) ---
        # Simple valuation status based on P/E ratio comparison
        current_price = info.get("currentPrice", 0)
        pe_ratio = info.get("trailingPE")
        forward_pe = info.get("forwardPE")
        
        # Quick valuation assessment
        valuation_status = "Unknown"
        if pe_ratio and forward_pe:
            if pe_ratio < forward_pe * 0.85:
                valuation_status = "Undervalued"
            elif pe_ratio > forward_pe * 1.15:
                valuation_status = "Overvalued"
            else:
                valuation_status = "Fairly Valued"
        elif pe_ratio:
            # Use industry average as benchmark (rough estimate)
            if pe_ratio < 15:
                valuation_status = "Undervalued"
            elif pe_ratio > 25:
                valuation_status = "Overvalued"
            else:
                valuation_status = "Fairly Valued"

        # --- Scoring Logic (Refined) ---
        score_criteria = []
        
        def check_trend(series, trend_type="increasing", tolerance=0.05):
            # Drop NaNs first
            series = series.dropna()
            
            if series.empty or len(series) < 2: return False
            
            # Ensure Descending Order (Newest First)
            series = series.sort_index(ascending=False)
            
            # Series is descending by date (Newest at index 0)
            newest = series.iloc[0]
            oldest = series.iloc[-1]
            
            if trend_type == "increasing":
                # 1. Overall Increase (Newest > Oldest)
                if newest > oldest: return True
                
                # 2. Linear Regression Slope (Check if generally trending up)
                try:
                    y = series.values
                    x = np.arange(len(y)) # 0, 1, 2... (Newest to Oldest)
                    # We want slope of Oldest -> Newest. 
                    # So reverse y to be Oldest -> Newest
                    y_rev = y[::-1]
                    x_rev = np.arange(len(y))
                    slope, _ = np.polyfit(x_rev, y_rev, 1)
                    if slope > 0: return True
                except:
                    pass

                # 3. Consistent Increase (Year over Year)
                chronological = series.iloc[::-1]
                consistent = True
                for i in range(1, len(chronological)):
                    prev = chronological.iloc[i-1]
                    curr = chronological.iloc[i]
                    # Allow tolerance fluctuation
                    if curr < prev * (1 - tolerance):
                        consistent = False
                        break
                return consistent

            elif trend_type == "stable_increasing":
                # Pass if Newest >= Oldest * (1 - tolerance)
                if newest >= oldest * (1 - tolerance): return True
                
                # Check Slope for "Stable/Increasing"
                try:
                    y_rev = series.values[::-1]
                    x_rev = np.arange(len(series))
                    slope, _ = np.polyfit(x_rev, y_rev, 1)
                    if slope >= 0: return True # Positive or flat slope
                except:
                    pass
                return False

            elif trend_type == "reducing_stable":
                # Pass if Newest <= Oldest * (1 + tolerance)
                if newest <= oldest * (1 + tolerance): return True
                
                # Check Slope (should be negative or zero)
                try:
                    y_rev = series.values[::-1]
                    x_rev = np.arange(len(series))
                    slope, _ = np.polyfit(x_rev, y_rev, 1)
                    if slope <= 0: return True
                except:
                    pass
                return False
                
            return False

        # 0. Historical Trend (20 Years) - Moved to Top
        trend_pass = False
        trend_val = "N/A"
        
        try:
            if not history.empty:
                # Filter last 20 years
                cutoff_date = pd.Timestamp.now() - pd.DateOffset(years=20)
                
                # Make cutoff timezone-aware if history index is timezone-aware
                if history.index.tz is not None:
                    cutoff_date = cutoff_date.tz_localize(history.index.tz)
                
                hist_20y = history[history.index >= cutoff_date]
                
                if not hist_20y.empty:
                    start_price = hist_20y["Close"].iloc[0]
                    end_price = hist_20y["Close"].iloc[-1]
                    max_price = hist_20y["Close"].max()
                    
                    # Calculate CAGR
                    # Ensure we have at least some duration to avoid division by zero
                    days = (hist_20y.index[-1] - hist_20y.index[0]).days
                    years = days / 365.25
                    
                    if years > 1 and start_price > 0:
                        cagr = (end_price / start_price) ** (1 / years) - 1
                    else:
                        # Fallback for very short history or zero start price
                        cagr = 0
                        
                    # Calculate Drawdown from All-Time High (in this period)
                    drawdown = (max_price - end_price) / max_price if max_price > 0 else 0
                    
                    # Logic Implementation
                    if cagr < 0:
                        # Scenario C: Downtrend
                        trend_pass = False
                        trend_val = f"Downtrend (CAGR {cagr:.1%})"
                    elif cagr < 0.05:
                        # Scenario B: Stagnant / Low Growth
                        trend_pass = False
                        trend_val = f"Stagnant (CAGR {cagr:.1%})"
                    elif drawdown > 0.30:
                        # Scenario A: Significant Decline from Peak
                        trend_pass = False
                        trend_val = f"Declining (Down {drawdown:.1%} from High)"
                    else:
                        # Pass: Strong Growth + Momentum
                        trend_pass = True
                        trend_val = f"Increasing (CAGR {cagr:.1%})"
                        
        except Exception as e:
            print(f"Error calculating historical trend: {e}")
            trend_val = "Error"

        score_criteria.append({"name": "Historical Trend (20Y)", "status": "Pass" if trend_pass else "Fail", "value": trend_val})

        # 1. Net Income / Operating Income (Conditional)
        ni_pass = check_trend(net_income_series, "increasing")
        
        if ni_pass:
            score_criteria.append({"name": "Net Income Increasing", "status": "Pass", "value": "Pass"})
        else:
            # If Net Income fails, check Operating Income
            oi_pass = check_trend(op_income_series, "increasing")
            if oi_pass:
                score_criteria.append({"name": "Operating Income Increasing", "status": "Pass", "value": "Pass"})
            else:
                # Both failed, default to showing Net Income failure
                score_criteria.append({"name": "Net Income Increasing", "status": "Fail", "value": "Fail"})
        
        # 2. Operating Cash Flow
        ocf_pass = check_trend(op_cash_flow_series, "increasing")
        score_criteria.append({"name": "Operating Cash Flow Increasing", "status": "Pass" if ocf_pass else "Fail", "value": "Pass" if ocf_pass else "Fail"})

        # 4. Revenue
        rev_pass = check_trend(revenue_series, "increasing")
        score_criteria.append({"name": "Revenue Increasing", "status": "Pass" if rev_pass else "Fail", "value": "Pass" if rev_pass else "Fail"})
        
        # 5. Gross Margin (Stable/Increasing)
        gm_pass = check_trend(gross_margin_series, "stable_increasing", tolerance=0.1)
        score_criteria.append({"name": "Gross Margin Stable/Increasing", "status": "Pass" if gm_pass else "Fail", "value": "Pass" if gm_pass else "Fail"})
        
        # 6. Net Margin (Stable/Increasing)
        nm_pass = check_trend(net_margin_series, "stable_increasing", tolerance=0.1)
        score_criteria.append({"name": "Net Margin Stable/Increasing", "status": "Pass" if nm_pass else "Fail", "value": "Pass" if nm_pass else "Fail"})
        
        # 7. ROE 12-15% (>= 12%)
        roe_val = roe_ttm
        roe_pass = roe_val >= 0.12
        score_criteria.append({"name": "ROE > 12-15%", "status": "Pass" if roe_pass else "Fail", "value": f"{roe_val*100:.2f}%"})
        
        # 8. ROIC 12-15% (>= 12%)
        roic_pass = roic >= 0.12
        score_criteria.append({"name": "ROIC > 12-15%", "status": "Pass" if roic_pass else "Fail", "value": f"{roic*100:.2f}%"})
        
        # 9. Revenue vs Receivables
        rev_ar_pass = False
        if not accounts_receivable_series.empty and not revenue_series.empty:
            current_rev = revenue_series.iloc[0]
            current_ar = accounts_receivable_series.iloc[0]
            if current_rev > current_ar:
                rev_ar_pass = True
            else:
                # Check Growth
                if len(accounts_receivable_series) >= 2 and len(revenue_series) >= 2:
                    rev_growth = (revenue_series.iloc[0] - revenue_series.iloc[-1]) / abs(revenue_series.iloc[-1])
                    ar_growth = (accounts_receivable_series.iloc[0] - accounts_receivable_series.iloc[-1]) / abs(accounts_receivable_series.iloc[-1])
                    if rev_growth > ar_growth:
                        rev_ar_pass = True
        score_criteria.append({"name": "Revenue > AR or Growing Faster", "status": "Pass" if rev_ar_pass else "Fail", "value": "Pass" if rev_ar_pass else "Fail"})
        
        # 10. CCC (Physical Goods only)
        ccc_series = pd.Series(dtype='float64')
        has_physical_goods = False
        ccc_not_applicable_reason = ""
        
        try:
            # Check if company has inventory
            recent_inventory = get_ttm_val(ttm_balance, "Inventory")
            if recent_inventory > 0:
                has_physical_goods = True
            else:
                ccc_not_applicable_reason = "Company does not handle physical inventory"
            
            if has_physical_goods:
                ccc_values = []
                ccc_dates = []
                for i in range(min(5, len(balance_sheet.columns))):
                    inventory = get_val_by_index(balance_sheet, "Inventory", i)
                    ar = get_val_by_index(balance_sheet, "Accounts Receivable", i)
                    ap = get_val_by_index(balance_sheet, "Accounts Payable", i)
                    cogs = get_val_by_index(financials, "Cost Of Revenue", i)
                    revenue_val = get_val_by_index(financials, "Total Revenue", i)
                    
                    if cogs > 0 and revenue_val > 0:
                        days_inventory = (inventory / cogs) * 365 if inventory and cogs else 0
                        days_receivable = (ar / revenue_val) * 365 if ar and revenue_val else 0
                        days_payable = (ap / cogs) * 365 if ap and cogs else 0
                        ccc = days_inventory + days_receivable - days_payable
                        ccc_values.append(ccc)
                        ccc_dates.append(balance_sheet.columns[i])
                
                if ccc_values:
                    ccc_series = pd.Series(ccc_values, index=ccc_dates)
                    ccc_pass = check_trend(ccc_series, "reducing_stable", tolerance=0.1)
                    score_criteria.append({"name": "CCC Stable/Reducing", "status": "Pass" if ccc_pass else "Fail", "value": f"{ccc_series.iloc[0]:.0f} days"})
        except Exception as e:
            print(f"Error calculating CCC: {e}")

        # 11. Economic Moat (Calculated Score)
        # Proxies for Moat Factors:
        # 1. Brand Monopoly -> Gross Margin (>40% High, >20% Low)
        # 2. High Barriers -> ROIC (>15% High, >10% Low)
        # 3. Economies of Scale -> Revenue (>100B High, >10B Low)
        # 4. Network Effect -> Net Margin (>20% High, >10% Low)
        # 5. Switching Cost -> Revenue Growth (>15% High, >5% Low)
        
        moat_score = 0
        
        # Brand (Gross Margin)
        gm_val = gross_margin_series.iloc[0] if not gross_margin_series.empty else 0
        if gm_val > 40: moat_score += 1
        elif gm_val > 20: moat_score += 0.5
        
        # Barriers (ROIC)
        if roic > 0.15: moat_score += 1
        elif roic > 0.10: moat_score += 0.5
        
        # Scale (Revenue)
        rev_val = revenue_series.iloc[0] if not revenue_series.empty else 0
        if rev_val > 100e9: moat_score += 1
        elif rev_val > 10e9: moat_score += 0.5
        
        # Network (Net Margin)
        nm_val = net_margin_series.iloc[0] if not net_margin_series.empty else 0
        if nm_val > 20: moat_score += 1
        elif nm_val > 10: moat_score += 0.5
        
        # Switching (Revenue Growth)
        if revenue_growth > 0.15: moat_score += 1
        elif revenue_growth > 0.05: moat_score += 0.5
        
        moat_type = "None"
        if moat_score > 3: moat_type = "Wide"
        elif moat_score >= 2: moat_type = "Narrow"
        
        moat_pass = moat_type in ["Wide", "Narrow"]
        score_criteria.append({"name": "Economic Moat", "status": "Pass" if moat_pass else "Fail", "value": f"{moat_type} ({moat_score}/5)"})
        
        # 12. Debt/EBITDA < 3
        de_val = debt_to_ebitda if debt_to_ebitda is not None else 100
        de_pass = de_val < 3
        score_criteria.append({"name": "Debt/EBITDA < 3", "status": "Pass" if de_pass else "Fail", "value": f"{de_val:.2f}" if de_val != 100 else "N/A"})
        
        # 13. Debt Servicing Ratio < 30
        dsr_val = debt_servicing_ratio if debt_servicing_ratio is not None else 100
        dsr_pass = dsr_val < 30
        score_criteria.append({"name": "Debt Servicing Ratio < 30%", "status": "Pass" if dsr_pass else "Fail", "value": f"{dsr_val:.2f}%" if dsr_val != 100 else "N/A"})
        
        # 14. Current Ratio > 1.5
        cr_val = current_ratio if current_ratio is not None else 0
        cr_pass = cr_val > 1.5
        score_criteria.append({"name": "Current Ratio > 1.5", "status": "Pass" if cr_pass else "Fail", "value": f"{cr_val:.2f}"})
        
        # 15. Gearing Ratio < 45 (REIT only)
        if is_reit:
            gr_val = gearing_ratio if gearing_ratio is not None else 100
            gr_pass = gr_val < 45
            score_criteria.append({"name": "Gearing Ratio < 45%", "status": "Pass" if gr_pass else "Fail", "value": f"{gr_val:.2f}%" if gr_val != 100 else "N/A"})



        # --- Weighted Scoring Logic ---
        
        # Define weights for different scenarios
        # Scenario 1: CCC Applicable (Physical Goods)
        weights_ccc = {
            "Historical Trend (20Y)": 15,
            "Net Income Increasing": 5, "Operating Income Increasing": 5, # Combined logic handles which one is present
            "Operating Cash Flow Increasing": 5,
            "Revenue Increasing": 10,
            "Gross Margin Stable/Increasing": 10,
            "Net Margin Stable/Increasing": 5,
            "ROE > 12-15%": 5,
            "ROIC > 12-15%": 15,
            "Revenue > AR or Growing Faster": 1,
            "CCC Stable/Reducing": 3,
            "Economic Moat": 20,
            "Debt/EBITDA < 3": 5,
            "Debt Servicing Ratio < 30%": 1,
            "Current Ratio > 1.5": 5
        }

        # Scenario 2: REITs (Gearing Ratio)
        weights_reit = {
            "Historical Trend (20Y)": 10,
            "Net Income Increasing": 3, "Operating Income Increasing": 3,
            "Operating Cash Flow Increasing": 3,
            "Revenue Increasing": 3,
            "Gross Margin Stable/Increasing": 5,
            "Net Margin Stable/Increasing": 5,
            "ROE > 12-15%": 10,
            "ROIC > 12-15%": 15,
            "Revenue > AR or Growing Faster": 4,
            "Economic Moat": 5,
            "Debt/EBITDA < 3": 15,
            "Debt Servicing Ratio < 30%": 15,
            "Current Ratio > 1.5": 5,
            "Gearing Ratio < 45%": 5
        }

        # Scenario 3: Standard (No CCC, No Gearing)
        weights_standard = {
            "Historical Trend (20Y)": 5,
            "Net Income Increasing": 10, "Operating Income Increasing": 10,
            "Operating Cash Flow Increasing": 10,
            "Revenue Increasing": 5,
            "Gross Margin Stable/Increasing": 10,
            "Net Margin Stable/Increasing": 5,
            "ROE > 12-15%": 15,
            "ROIC > 12-15%": 15,
            "Revenue > AR or Growing Faster": 5,
            "Economic Moat": 20,
            "Debt/EBITDA < 3": 5,
            "Debt Servicing Ratio < 30%": 2,
            "Current Ratio > 1.5": 3
        }

        # Determine which weight set to use
        current_weights = {}
        if is_reit:
            current_weights = weights_reit
        elif has_physical_goods: # CCC Applicable
            current_weights = weights_ccc
        else:
            current_weights = weights_standard

        total_score = 0
        max_score = 0 # Should sum to 100 ideally, but we calculate dynamically to be safe

        for criterion in score_criteria:
            name = criterion["name"]
            # Handle partial matches for combined criteria names if necessary, 
            # but here we map exact names or simplified keys.
            
            # Normalize name for lookup (remove specific values like "(20Y) increasing")
            lookup_name = name
            if "Historical Trend" in name: lookup_name = "Historical Trend (20Y)"
            if "Net Income Increasing" in name: lookup_name = "Net Income Increasing"
            if "Operating Income Increasing" in name: lookup_name = "Operating Income Increasing"
            
            weight = current_weights.get(lookup_name, 0)
            
            # Add to max score
            max_score += weight
            
            # Add to total score if passed
            if criterion["status"] == "Pass":
                total_score += weight

        # Normalize to 100 if max_score is not 100 (just in case)
        # But based on user request, these are percentages, so max_score should be ~100.
        # We will return the raw weighted score.
        
        # Update the criteria list to include weights for frontend display if needed (optional)
        # for c in score_criteria:
        #     c["weight"] = current_weights.get(c["name"], 0)

        v_start = time.time()
        # --- Valuation Logic ---
        valuation_data = {}
        try:
            # Re-fetch growth estimates if necessary or use what we have
            valuation_data = calculate_intrinsic_value(
                ticker, info, financials, balance_sheet, cashflow,
                revenue_series, net_income_series, op_cash_flow_series,
                growth_estimates_data, beta=beta_val,
                raw_growth_estimates_data=raw_growth_estimates_data,
                revenue_estimates_data=revenue_estimates_data,
                history=history,
                stock_obj=stock
            )
        except Exception as e:
            print(f"Error calculating valuation: {e}")
            valuation_data = {"status": "Error", "intrinsicValue": 0, "method": "Error", "assumptions": {}}
        print(f"DEBUG: Valuation calculated in {time.time() - v_start:.2f}s")

        sr_start = time.time()
        # --- Support Resistance Calculation ---
        support_resistance_data = {}
        try:
            levels = get_validated_support_levels(ticker)
            support_resistance_data = {"levels": levels}
        except Exception as e:
            print(f"Error calculating support levels: {e}")
        print(f"DEBUG: Support Resistance calculated in {time.time() - sr_start:.2f}s")

        print(f"--- TOTAL TIME FOR {ticker}: {time.time() - start_time:.2f}s ---")
        final_response = {
            "overview": {**overview, "ceo": ceo},
            "growth": {
                "revenueGrowth": revenue_growth,
                "revenueHistory": revenue_history,
                "estimates": growth_estimates_data,
                "tables": {
                    "total_revenue": format_series_table(revenue_series, "Total Revenue"),
                    "net_income": format_series_table(net_income_series, "Net Income"),
                    "operating_income": format_series_table(op_income_series, "Operating Income"),
                    "operating_cash_flow": format_series_table(op_cash_flow_series, "Operating Cash Flow"), 
                    "gross_margin": format_series_table(gross_margin_series, "Gross Margin"),
                    "net_margin": format_series_table(net_margin_series, "Net Margin"),
                }
            },
            "profitability": {
                "grossMargin": gross_margin_series.iloc[0] if not gross_margin_series.empty else 0,
                "netMargin": net_margin_series.iloc[0] if not net_margin_series.empty else 0,
                "roe": roe_ttm,  # Use TTM calculated value
                "roa": info.get("returnOnAssets"),
                "roic": roic,
                "ccc_history": format_series_table(ccc_series, "Cash Conversion Cycle (Days)"),
                "ccc_not_applicable_reason": ccc_not_applicable_reason,
                "tables": {
                    "accounts_receivable": format_series_table(accounts_receivable_series, "Accounts Receivable"),
                    "total_revenue": format_series_table(revenue_series, "Total Revenue"),
                }
            },
            "debt": {
                "debtToEbitda": debt_to_ebitda,
                "currentRatio": current_ratio,
                "debtServicingRatio": debt_servicing_ratio,
                "gearingRatio": gearing_ratio,
                "isREIT": is_reit
            },
            "history": history_data,
            "intraday_history": intraday_data,
            "moat": {
                "type": moat_type,
                "details": "High ROE and Margins indicate potential moat"
            },
            "valuation": valuation_data,
            "financials": {
                "income_statement": financials_data,
                "balance_sheet": balance_sheet_data,
                "cash_flow": cashflow_data,
                "growth_estimates": growth_estimates_data
            },
            "calendar": calendar_data,
            "news": news_data,
            "sharesOutstanding": shares_outstanding,
            "support_resistance": support_resistance_data,
            "score": {
                "total": total_score,
                "max": max_score,
                "criteria": score_criteria
            },
            "raw_growth_estimates": raw_growth_estimates_data
        }
        
        # Log summary of the response for the user
        print(f"--- [API] Returning data for {ticker} ---")
        print(f"Payload Size: {len(str(final_response))} characters")
        return final_response

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching data for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stock/history/{ticker}")
async def get_stock_history(ticker: str, period: str = "20y"):
    try:
        stock = yf.Ticker(ticker)
        history = stock.history(period=period)
        if history.empty:
            return []
        
        # Format: [{date, close}, ...]
        history_data = [{"date": date.strftime("%Y-%m-%d"), "close": close} for date, close in zip(history.index, history["Close"])]
        return history_data
    except Exception as e:
        print(f"Error fetching history: {e}")
        return []

@app.get("/api/currency-rate")
async def get_currency_rate_endpoint(target: str = "SGD"):
    """
    Returns the exchange rate from USD to {target}.
    """
    try:
        rate = get_forex_rate(target.upper(), "USD")
        return {"rate": rate}
    except Exception as e:
        print(f"Error in currency endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel, Field
from typing import List, Optional

class PortfolioItem(BaseModel):
    ticker: str
    shares: float
    totalCost: float
    date: str = Field(alias="purchaseDate")
    class Config:
        populate_by_name = True
        extra = "ignore"

class PortfolioTWRRequest(BaseModel):
    items: List[PortfolioItem]
    uid: Optional[str] = None

@app.post("/api/portfolio/twr")
async def get_portfolio_twr(payload: PortfolioTWRRequest):
    items = payload.items
    uid = payload.uid
    
    print(f"--- [API] Calculating Portfolio TWR for {len(items)} items ---")
    
    # --- Caching Logic ---
    # Generate a hash of the input items to detect ANY changes (edits/adds/deletes)
    # We stringify the sorted items to ensure consistency
    import hashlib
    items_str = json.dumps([item.dict() for item in items], sort_keys=True, default=str)
    input_hash = hashlib.md5(items_str.encode()).hexdigest()

    if db and uid:
        try:
            doc_ref = db.collection('users').document(uid).collection('portfolio_stats').document('performance')
            doc = doc_ref.get()
            
            if doc.exists:
                data = doc.to_dict()
                cached_date = data.get('last_updated')
                cached_hash = data.get('input_hash')
                
                # Check 1: Is cache from today?
                is_today = False
                if cached_date:
                    try:
                        cd = cached_date.date() if hasattr(cached_date, 'date') else datetime.fromisoformat(str(cached_date)).date()
                        if cd == datetime.now(timezone.utc).date():
                            is_today = True
                    except:
                        pass
                
                # Check 2: Exact Match of Portfolio Inputs
                if is_today and cached_hash == input_hash:
                    print("DEBUG: Returning Cached TWR Data from Firestore")
                    return data.get('result')

        except Exception as e:
            print(f"Cache Read Error: {e}")

    # Calculate
    result = await calculate_portfolio_twr(items)
    
    # Save to Cache
    if db and uid and result:
        try:
            doc_ref = db.collection('users').document(uid).collection('portfolio_stats').document('performance')
            doc_ref.set({
                'result': result,
                'last_updated': datetime.now(timezone.utc),
                'input_hash': input_hash
            })
            print("DEBUG: Saved TWR result to Firestore")
        except Exception as e:
            print(f"Cache Write Error: {e}")
            
    return result

async def calculate_portfolio_twr(items: List[PortfolioItem]):
    """
    Calculates Time Weighted Returns (TWR) for the portfolio and individual stocks
    using the GIPS standard with Start-of-Day (SOD) flows.
    
    Methodology:
    1. Flows (Buys/Deposits) are assumed to happen at the START of the day.
    2. Denominator (Basis) for the day = Value_Prev_Close + Inflow_Cost.
    3. Numerator (End Value) = (Old_Shares + New_Shares) * Today_Close_Price.
    4. Daily Return = End_Value / Basis - 1.
    
    This ensures that the price movement of the new shares on the day of purchase 
    is CAPTURED in that day's return.
    """
    try:
        if not items:
            return {"total_twr": 0, "tickers": {}}

        unique_tickers = set(item.ticker for item in items)
        
        # 1. Standardize Flows
        # Map: Date -> List of {ticker, shares, cost}
        flows_by_date = {}
        processed_tickers = set()
        
        for item in items:
            processed_tickers.add(item.ticker)
            try:
                # Normalize to midnight date
                d = pd.Timestamp(datetime.strptime(item.date, "%Y-%m-%d").date())
                if d not in flows_by_date:
                    flows_by_date[d] = []
                flows_by_date[d].append({
                    'ticker': item.ticker,
                    'shares': item.shares,
                    'cost': item.totalCost
                })
            except Exception as e:
                print(f"WARN: Invalid date for item {item.ticker}: {e}")
                continue

        if not flows_by_date:
             return {"total_twr": 0, "tickers": {}}
             
        # Determine global time range
        min_date = min(flows_by_date.keys())
        end_date = pd.Timestamp.now().normalize()
        all_dates = pd.date_range(start=min_date, end=end_date, freq='D')
        
        # 2. Fetch Adjusted History (Total Return)
        # Fetch 7 days prior to capture Friday close for weekend/holiday purchases
        fetch_start = min_date - pd.Timedelta(days=7)
        print(f"DEBUG: Fetching history from {fetch_start.strftime('%Y-%m-%d')}")
        history_map = {}
        ticker_currencies = {}
        
        for ticker in processed_tickers:
            try:
                # Reuse ticker object
                obj = yf.Ticker(ticker)
                
                # auto_adjust=True for Dividends -> Total Return Price
                h = obj.history(start=fetch_start.strftime("%Y-%m-%d"), auto_adjust=True)
                
                # Check Currency
                try:
                    curr = obj.fast_info['currency']
                    ticker_currencies[ticker] = curr
                except:
                    ticker_currencies[ticker] = 'USD' # Default
                
                # Ensure index is normalized to midnight and remove timezone for easy lookup
                if h.index.tz is not None:
                    h.index = h.index.tz_localize(None)
                h.index = h.index.normalize()
                
                # print(f"DEBUG: {ticker} history start: {h.index[0] if not h.empty else 'EMPTY'}")
                history_map[ticker] = h['Close']
            except Exception as e:
                 print(f"WARN: Failed history for {ticker}: {e}")

        # 2a. Normalize to USD (Fetch FX)
        unique_currencies = set(c for c in ticker_currencies.values() if c and c.upper() != 'USD')
        fx_map = {}
        
        if unique_currencies:
            print(f"DEBUG: Need FX for: {unique_currencies}")
            # Map currency to pair, e.g. SGD -> SGD=X
            # Assumes Quote is Currency per 1 USD (e.g. SGD=1.34)
            fx_tickers = [f"{c}=X" for c in unique_currencies] 
            
            try:
                 # Fetch batch FX
                 print(f"DEBUG: Fetching FX: {fx_tickers}")
                 fx_data_all = yf.download(fx_tickers, start=fetch_start.strftime("%Y-%m-%d"), progress=False)
                 
                 # Handle structure variations (MultiIndex vs Single Level)
                 fx_closes = None
                 if 'Close' in fx_data_all:
                     fx_closes = fx_data_all['Close']
                 else:
                     # Fallback if structure is different
                     fx_closes = fx_data_all
                 
                 # Ensure proper DateTime index
                 if fx_closes.index.tz is not None:
                     fx_closes.index = fx_closes.index.tz_localize(None)
                 fx_closes.index = fx_closes.index.normalize()
                 
                 # Map back to Currency Code
                 for c in unique_currencies:
                      symbol = f"{c}=X"
                      series = None
                      
                      # Check if result is Series (single ticker) or DataFrame (multiple)
                      if isinstance(fx_closes, pd.Series):
                          # Check if the single ticker matches (unlikely name mismatch but safe check)
                          # Actually yf.download list usually returns DF unless 1 item not list
                          series = fx_closes
                      elif isinstance(fx_closes, pd.DataFrame):
                          if symbol in fx_closes.columns:
                              series = fx_closes[symbol]
                          elif len(unique_currencies) == 1 and len(fx_closes.columns) == 1:
                              # Case where column might not be named symbol exactly if 1 requested
                              series = fx_closes.iloc[:, 0]
                      
                      if series is not None:
                           fx_map[c] = series
            except Exception as e:
                print(f"WARN: FX Fetch failed: {e}")

        # Convert History to USD
        for ticker, series in history_map.items():
            curr = ticker_currencies.get(ticker, 'USD')
            if curr and curr.upper() != 'USD' and curr in fx_map:
                try:
                    rate = fx_map[curr]
                    # Align rate to the stock series dates
                    # We reindex rate to match stock series, ffill to handle gaps (holidays)
                    aligned_rate = rate.reindex(series.index, method='ffill').fillna(method='bfill')
                    
                    # Log check
                    # print(f"DEBUG: Converting {ticker}. Price: {series.iloc[-1]:.2f}, Rate: {aligned_rate.iloc[-1]:.4f}")
                    
                    # Convert: Price_USD = Price_Local / Rate
                    # Example: Price 134 SGD, Rate 1.34. Price USD = 100. Correct.
                    history_map[ticker] = series / aligned_rate
                except Exception as e:
                    print(f"WARN: Failed to convert {ticker} to USD: {e}")

        # 3. Calculate Portfolio TWR
        # State
        current_shares = {t: 0.0 for t in processed_tickers}
        portfolio_twr = 1.0
        v_prev_close = 0.0 # Portfolio Value at close of yesterday
        
        last_known_prices = {t: 0.0 for t in processed_tickers}

        # We also want to calculate Individual TWRs in the same loop or separate?
        # Let's do separate tracking for individual TWRs to keep logic clean.
        ticker_states = {t: {'shares': 0.0, 'twr': 1.0, 'v_prev': 0.0} for t in processed_tickers}
        
        chart_data = [] # To store daily performance

        for date in all_dates:
            # Skip weekends if no price data? 
            # Actually, we should check if we have ANY price data for this date.
            # If it's a weekend, usually no price updates, returns are 0.
            
            # --- START OF DAY ---
            # Apply Flows First (SOD Assumption)
            todays_total_inflow = 0.0
            todays_ticker_inflows = {t: 0.0 for t in processed_tickers}
            
            if date in flows_by_date:
                for flow in flows_by_date[date]:
                    t = flow['ticker']
                    # Update Shares
                    current_shares[t] += flow['shares']
                    ticker_states[t]['shares'] += flow['shares']
                    
                    # Track Cost Inflow for Basis
                    todays_total_inflow += flow['cost']
                    todays_ticker_inflows[t] += flow['cost']
                    
                    # Initialize last_known_price if not set (fallback to cost basis)
                    if last_known_prices[t] == 0 and flow['shares'] > 0:
                        last_known_prices[t] = flow['cost'] / flow['shares']
            
            # --- END OF DAY ---
            # Calculate Value of Holdings at TODAY'S Close
            v_end_today = 0.0
            v_end_tickers = {t: 0.0 for t in processed_tickers}
            
            for t, qty in current_shares.items():
                if qty != 0:
                    # Get Price
                    price = 0.0
                    
                    # Try lookup
                    if t in history_map and not history_map[t].empty:
                        if date in history_map[t].index:
                            price = history_map[t].loc[date]
                            last_known_prices[t] = price
                        elif last_known_prices[t] > 0:
                            # Forward fill / Use last known
                            price = last_known_prices[t]
                        else:
                            # Try to find previous valid price in history (if any before today)
                            try:
                                # This is fallback if we missed setting last_known_prices
                                idx = history_map[t].index.get_indexer([date], method='pad')[0]
                                if idx != -1:
                                    price = history_map[t].iloc[idx]
                                    last_known_prices[t] = price
                            except:
                                pass
                    
                    # Last resort: use last_known_price even if not in history map (from cost basis)
                    if price == 0 and last_known_prices[t] > 0:
                        price = last_known_prices[t]
                    
                    val = qty * price
                    v_end_today += val
                    v_end_tickers[t] = val

            # --- CALCULATE RETURN ---
            # Portfolio Level
            # Basis = Yesterday's Close Value + Today's Inflow Check
            basis = v_prev_close + todays_total_inflow
            
            if basis > 0.001: # Avoid div/0
                # Return = V_end / Basis - 1
                r = (v_end_today / basis) - 1
                portfolio_twr *= (1 + r)
            
            # Record Daily Cummulative TWR
            chart_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "value": (portfolio_twr - 1) * 100
            })

            # Update Prev for next day
            v_prev_close = v_end_today
            
            # Ticker Level Loops
            for t in processed_tickers:
                state = ticker_states[t]
                t_basis = state['v_prev'] + todays_ticker_inflows[t]
                t_end = v_end_tickers[t]
                
                if t_basis > 0.001:
                    tr = (t_end / t_basis) - 1
                    state['twr'] *= (1 + tr)
                
                state['v_prev'] = t_end

        # Format Results
        result_ticker_twrs = {}
        for t, state in ticker_states.items():
            result_ticker_twrs[t] = (state['twr'] - 1) * 100
            
        final_total_twr = (portfolio_twr - 1) * 100
        print(f"DEBUG: Final GIPS TWR: {final_total_twr:.2f}%")

        return {
            "total_twr": final_total_twr,
            "tickers": result_ticker_twrs,
            "chart_data": chart_data
        }

    except Exception as e:
        print(f"Error checking implementation: {e}")
        import traceback
        traceback.print_exc()
        return {"total_twr": 0, "tickers": {}}

import math

def clean_nan(obj):
    if isinstance(obj, float):
        return None if math.isnan(obj) or math.isinf(obj) else obj
    elif isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan(v) for v in obj]
    return obj

@app.get("/api/chart/{ticker}/{timeframe}")
async def get_chart(ticker: str, timeframe: str):
    """
    Fetch chart data with appropriate interval based on timeframe.
    Timeframes: 1D, 5D, 1M, 3M, 6M, YTD, 1Y, 5Y, All
    """
    try:
        stock = yf.Ticker(ticker)
        
        # Map timeframe to yfinance period and interval
        # We fetch extra data for SMA calculation, then trim to display
        # NOTE: yfinance has limits on intraday data - 30m interval max is 60 days
        timeframe_config = {
            "1D": {"fetch_period": "5d", "interval": "1m", "display_points": None},  # Show last day
            "5D": {"fetch_period": "1mo", "interval": "5m", "display_points": None},  # Show last 5 days
            "1M": {"fetch_period": "60d", "interval": "30m", "display_points": 260},  # yfinance 30m limit is 60 days
            "3M": {"fetch_period": "6mo", "interval": "1h", "display_points": None},  # Show last 3 months
            "6M": {"fetch_period": "2y", "interval": "1h", "display_points": 960},  # Fetch 2y, show 6M (~960 hours = 6mo * 30d * 6.5h/day)
            "YTD": {"fetch_period": "2y", "interval": "1d", "display_points": None},  # Fetch 2y, filter to YTD
            "1Y": {"fetch_period": "3y", "interval": "1d", "display_points": 252},  # Fetch 3y, show 1Y (~252 trading days)
            "5Y": {"fetch_period": "10y", "interval": "1wk", "display_points": 260},  # Fetch 10y, show 5Y (~260 weeks)
            "All": {"fetch_period": "max", "interval": "1mo", "display_points": None}  # Show all
        }
        
        config = timeframe_config.get(timeframe, {"fetch_period": "1y", "interval": "1d", "display_points": None})
        
        # Fetch historical data (more than we'll display)
        history = stock.history(period=config["fetch_period"], interval=config["interval"])
        
        # Calculate SMAs on the FULL dataset
        for sma_period in [50, 100, 150, 200]:
            history[f"SMA_{sma_period}"] = history["Close"].rolling(window=sma_period).mean()
        
        # Trim to display period
        if config["display_points"]:
            history = history.tail(config["display_points"])
        elif timeframe == "YTD":
            # Filter to year-to-date
            current_year = pd.Timestamp.now().year
            history = history[history.index.year == current_year]
        elif timeframe in ["1D", "5D", "1M", "3M"]:
            # For these timeframes, show the most recent data
            # Calculate based on timeframe
            points_to_show = {
                "1D": 390,      # ~390 minutes in a trading day (6.5 hours)
                "5D": 390,      # ~390 5-min intervals over 5 days
                "1M": 260,      # ~260 30-min intervals in a month (30 days * 6.5 hours * 2)
                "3M": 585       # ~585 1-hour intervals in 3 months (90 days * 6.5 hours)
            }
            if timeframe in points_to_show:
                history = history.tail(points_to_show[timeframe])
        
        # Format data
        chart_data = []
        for date, row in history.iterrows():
            # Format date/time based on interval
            if config["interval"] in ["1m", "5m", "30m", "1h"]:
                date_str = date.strftime("%Y-%m-%d %H:%M")
            else:
                date_str = date.strftime("%Y-%m-%d")
            
            item = {
                "date": date_str,
                "close": row["Close"]
            }
            
            # Add SMAs if they exist
            for sma_period in [50, 100, 150, 200]:
                if f"SMA_{sma_period}" in row and not pd.isna(row[f"SMA_{sma_period}"]):
                    item[f"SMA_{sma_period}"] = row[f"SMA_{sma_period}"]
            
            chart_data.append(item)
        
        return clean_nan({"data": chart_data, "interval": config["interval"]})
        
    except Exception as e:
        print(f"Error fetching chart data for {ticker} ({timeframe}): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stock/{ticker}")
async def read_stock(ticker: str):
    print(f"\n--- [API] Received request for {ticker} ---")
    data = get_stock_data(ticker)
    return clean_nan(data)

@app.get("/api/evaluate_moat/{ticker}")
async def evaluate_moat(ticker: str):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not found in environment variables.")

    current_date = pd.Timestamp.now().strftime("%Y-%m-%d")
    
    prompt = f"""
    Evaluate the economic moat of the stock with code: {ticker}.
    Current Date: {current_date}.
    Please evaluate based on the latest information available as of this date.
    
    Criteria to evaluate:
    1. Brand Monopoly
    2. Network Effect
    3. Economy of Scale
    4. High Barrier to Entry
    5. High Switching Cost

    For each criteria, provide an evaluation of exactly one of these three values: "High", "Low", or "None".
    Also provide a short description (around 3 short sentences) explaining why you evaluated the stock this way.
    
    Return the response in the following JSON format ONLY, do not include markdown formatting or explanations outside the JSON:
    {{
      "brandMonopoly": "High/Low/None",
      "networkEffect": "High/Low/None",
      "economyOfScale": "High/Low/None",
      "highBarrierToEntry": "High/Low/None",
      "highSwitchingCost": "High/Low/None",
      "description": "Your short explanation here"
    }}
    """
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    models_to_try = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]
    last_exception = None

    # ... existing evaluate_moat logic ...
    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        
        try:
            response = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=30)
            response.raise_for_status()
            result = response.json()
            
            # Extract text from response
            try:
                if "candidates" not in result or not result["candidates"]:
                     continue

                text = result["candidates"][0]["content"]["parts"][0]["text"]
                # Clean up markdown if present (though responseMimeType should handle it)
                text = text.replace("```json", "").replace("```", "").strip()
                return json.loads(text)
            except (KeyError, IndexError, json.JSONDecodeError) as e:
                print(f"Error parsing Gemini response from {model}: {e}")
                last_exception = e
                continue # Try next model if parsing fails
                
        except requests.exceptions.RequestException as e:
            print(f"Gemini API Error with {model}: {e}")
            last_exception = e
            continue # Try next model

    # If we get here, all models failed
    raise HTTPException(status_code=500, detail=f"All Gemini models failed. Last error: {str(last_exception)}")

class PortfolioAnalysisRequest(BaseModel):
    items: List[PortfolioItem]
    metrics: dict
    uid: Optional[str] = None

@app.post("/api/portfolio/analyze")
async def analyze_portfolio(request: PortfolioAnalysisRequest):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not found in environment variables.")

    # --- Caching Logic ---
    if db and request.uid:
        try:
            doc_ref = db.collection('users').document(request.uid).collection('portfolio_analysis').document('latest')
            doc = doc_ref.get()
            
            if doc.exists:
                data = doc.to_dict()
                ts = data.get('timestamp')
                # Check if fresh (< 24 hours)
                if ts:
                    # Firestore Timestamp -> datetime
                    if hasattr(ts, 'timestamp'):
                        # It's a datetime object (Firestore)
                        delta = datetime.now(timezone.utc) - ts
                    else:
                        # Assume string
                        try:
                            ts_dt = datetime.fromisoformat(str(ts))
                            delta = datetime.now(timezone.utc) - ts_dt
                        except:
                            delta = timedelta(hours=999) # invalid

                    if delta < timedelta(hours=24):
                        print("DEBUG: Returning Cached Analysis from Firestore")
                        return {"analysis": data.get('analysis')}
        except Exception as e:
            print(f"Analysis Cache Read Error: {e}") 

    # --- End Cache Check ---

# 1. Calculate Sector Allocation & Identify Missing Sectors
    # We assume 'request.items' contains the current stock data
    current_allocations = {}
    total_value = 0

# Calculate total portfolio value first
    for item in request.items:
        # In a real app, you'd fetch the latest price; here we use cost as a proxy
        total_value += item.totalCost        

# Map your stocks to sectors
    user_sector_totals = {}
    for item in request.items:
        try:
            # We fetch info to get the sector for each ticker
            stock_info = yf.Ticker(item.ticker).info
            sector = stock_info.get('sector', 'Other')
            user_sector_totals[sector] = user_sector_totals.get(sector, 0) + item.totalCost
        except:
            continue

# Convert to percentages for the prompt
    sector_allocation_str = ", ".join([f"{s}: {(v/total_value)*100:.1f}%" for s, v in user_sector_totals.items()])
    
    # Find Missing Sectors
    # Note: Sector names from yfinance might vary slightly from GICS, but this is a solid proxy
    user_sector_names = set(user_sector_totals.keys())
    missing = [s for s in MAJOR_SECTORS if s not in user_sector_names]
    underweight_sectors = ", ".join(missing[:4]) # Suggest up to 4 missing sectors

# # Construct a more detailed holdings context
#     detailed_holdings = []
#     for item in request.items:
#         # You can pass extra info from the frontend to this endpoint
#         detailed_holdings.append(
#             f"- {item.ticker}: {item.shares} shares (Cost: {item.totalCost}). "
#         )
    
# 2. Construct the Prompt
    
    # We need to fetch detailed metrics for each item to pass to the prompt
    list_of_valuation_results = []
    
    for item in request.items:
        try:
            # get_stock_data returns a comprehensive dict with 'valuation', 'overview', etc.
            data = get_stock_data(item.ticker)
            val_data = data.get("valuation", {})
            raw_assumptions = val_data.get("raw_assumptions", {})
            overview = data.get("overview", {})
            
            # Extract specific metrics requested
            peg = overview.get("pegRatio")
            if peg is None: peg = "N/A"
            else: peg = f"{peg:.2f}"
            
            beta = overview.get("beta")
            if beta is None: beta = "N/A"
            else: beta = f"{beta:.2f}"
            
            growth_5y = val_data.get("growthRateNext5Y", 0)
            if growth_5y: growth_5y_str = f"{growth_5y*100:.1f}%"
            else: growth_5y_str = "N/A"
            
            # Calculate Cash-to-Debt
            # raw_assumptions has numbers (not strings) if clean_numeric worked
            cash = raw_assumptions.get("cash_and_equivalents", 0)
            debt = raw_assumptions.get("total_debt", 0)
            cash_to_debt = "N/A"
            
            if isinstance(cash, (int, float)) and isinstance(debt, (int, float)):
                if debt > 0:
                    cash_to_debt = f"{cash / debt:.2f}"
                elif cash > 0:
                    cash_to_debt = "High (Net Cash)"
            
            list_of_valuation_results.append({
                "intrinsicValue": val_data.get("intrinsicValue", 0),
                "currentPrice": val_data.get("currentPrice", 0),
                "status": val_data.get("status", "Unknown"),
                "peg": peg,
                "beta": beta,
                "growth_5y": growth_5y_str,
                "cash_to_debt": cash_to_debt
            })
        except Exception as e:
            print(f"Error fetching valuation for {item.ticker} for analysis: {e}")
            list_of_valuation_results.append({
                "intrinsicValue": 0,
                "currentPrice": 0,
                "status": "Error",
                "peg": "N/A", "beta": "N/A", "growth_5y": "N/A", "cash_to_debt": "N/A"
            })

    holdings_str = "\n".join([
        f"- {item.ticker}: {item.shares} shares. "
        f"(Intrinsic Value: ${val_data['intrinsicValue']:.2f}, "
        f"Current Price: ${val_data['currentPrice']:.2f}, "
        f"Status: {val_data['status']}, "
        f"PEG: {val_data['peg']}, "
        f"Beta: {val_data['beta']}, "
        f"5Y Growth Est: {val_data['growth_5y']}, "
        f"Cash/Debt: {val_data['cash_to_debt']})" 
        for item, val_data in zip(request.items, list_of_valuation_results)
    ])
    performance = request.metrics.get('totalTwr', 'N/A')
    # Enrichment from your metrics dictionary
    sector_context = request.metrics.get('sectorAllocation', 'N/A')
    performance = request.metrics.get('totalTwr', 'N/A')
    missing_sectors = request.metrics.get('underweightSectors', 'Defensive or Emerging Markets')

    prompt = f"""
    You are a Senior Quantitative Portfolio Manager and Fiduciary Strategist. 
    
    MANDATE: 
    Optimize this portfolio for a 12-15% annual return (or higher) while minimizing downside volatility and concentration risk. 
    
    PORTFOLIO DATA CORE (Inward):
    {holdings_str}
    - Weighted Portfolio Beta: {request.metrics.get('weightedBeta', 'N/A')}
    - Aggregate 5Y Growth Est: {request.metrics.get('weightedGrowth', 'N/A')}%
    - Portfolio TWR (Performance to Date): {performance}%
    - Sector Allocation: {sector_allocation_str}
    - Portfolio HHI (Concentration Index): {request.metrics.get('portfolioHHI', 'N/A')}
    
    OUTWARD LOOK (The Opportunity Set):
    - Benchmark: S&P 500 (Beta 1.0)
    - Underweight Sectors: {underweight_sectors}
    - Risk-Free Rate Proxy (10Y Treasury): ~4.2%
    - Target Return: 12-15% CAGR

    ANALYSIS REQUIREMENTS (Clinical & Data-Driven):
    1. **Allocation & Concentration Audit**: 
       - Evaluate the Sector Allocation and the Portfolio HHI. Is the portfolio "top-heavy" or over-concentrated in a few names or sectors? 
       - If HHI is <1500, validate the diversification. If HHI is > 1500 (moderate) or > 2500 (high), flag concentration risk and suggest specific rebalancing to lower concentration risk.
       - Assess if the weighted growth target is being skewed by 1-2 volatile tickers.
    
    2. **Growth-to-Value Efficiency**: 
       - Analyze the relationship between the Expected 5Y Growth and the average PEG Ratio of the holdings. 
       - Are we paying too much for the 12-15% target? Identify any "Growth at any Price" (GAAP) risks where PEG > 2.0.

    3. **Holdings Audit (Inward)**: 
       - **STAR**: Best-in-class PEG ratio with strong Cash-to-Debt ratios and >15% growth.
       - **LAGGARD**: High Beta (>1.2) or high Debt-to-Equity that threatens the "Low Risk" mandate.

    4. **The "Outward" Strategy**: 
       - Define the **Selection Basis** for new entries in {underweight_sectors} that offer high 5Y growth projections but lower the overall Portfolio Beta. 
       - Specify exactly what criteria (e.g., "Positive FCF Yield," "ROIC > 15%," or "Low Debt-to-EBITDA" or "Strong Pricing Power" or "Wide Economic moat", or "Low Debt-to-EBITDA") the user should look for to hit 12-15% growth safely.
       - Based on this criteria, list 5 illustrative "Strategic Peer Alternatives" (tickers) that fit this profile today.

    5. **Actionable Rebalancing Roadmap**: 
       - **Trim/Exit**: Clear recommendation for the laggard or overvalued assets.
       - **Tactical Entry**: How to integrate the scouted tickers to fix sector gaps.
       - **Optimization**: Provide 3 specific rebalancing moves (e.g., "Shift 5% from Sector A to Sector B") to push the portfolio toward the Efficient Frontier.
   
    FORMAT RULES:
    - Use **bold headers** for the 5 sections above.
    - Use bullet points for all details. 
    - **NO concluding summary** or generic advice after section 5.
    - Keep it under 350 words.
    """
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }
    
    models_to_try = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash"]
    
    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            response = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=30)
            response.raise_for_status()
            result = response.json()
             
            if "candidates" in result and result["candidates"]:
                text = result["candidates"][0]["content"]["parts"][0]["text"]
                
                # --- Save to Cache ---
                if db and request.uid:
                    try:
                        doc_ref = db.collection('users').document(request.uid).collection('portfolio_analysis').document('latest')
                        doc_ref.set({
                            'analysis': text,
                            'timestamp': datetime.now(timezone.utc)
                        })
                        print("DEBUG: Saved Analysis to Firestore")
                    except Exception as e:
                        print(f"Analysis Cache Write Error: {e}")
                
                return {"analysis": text}
                
        except Exception as e:
            print(f"Gemini Analysis Error ({model}): {e}")
            continue

    raise HTTPException(status_code=500, detail="Failed to generate analysis.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
