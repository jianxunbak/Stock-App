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
import concurrent.futures
import math

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
        print(f"SUCCESS: Firebase Admin Initialized with serviceAccountKey.json. Project: {db.project}")
    
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

# --- Health Check Endpoint ---
@app.get("/api/health/cache")
async def health_check_cache():
    return {
        "status": "online",
        "firebase_connected": db is not None,
        "mode": "hybrid_cache"
    }

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
        # --- 1. Basic Inputs ---
        current_price = info.get("currentPrice") or info.get("regularMarketPrice") or 0
        shares_outstanding = info.get("sharesOutstanding") or info.get("impliedSharesOutstanding") or 1
        
        if not current_price or not shares_outstanding:
            return {
                "status": "Error", "intrinsicValue": 0, "currentPrice": current_price,
                "method": "N/A", "assumptions": {}, "growthRateNext5Y": None,
                "allMethods": [],
                "growthNote": "Error: Missing price or share data"
            }

        sector = info.get("sector", "")
        industry = info.get("industry", "")
        country = info.get("country", "United States")
        is_financial = "Financial" in sector or "Bank" in industry or "Insurance" in industry
        
        # Enhanced growth helper
        enhanced_growth, growth_note = get_next_5y_growth(stock_obj, ticker, info)
        growth_rate_1_5 = min(max(enhanced_growth, -0.10), 0.35)
        growth_rate_6_10 = min(growth_rate_1_5, 0.15)
        growth_rate_11_20 = 0.06 if "China" in country else 0.04

        # Discount Rate
        beta_val = beta if beta else 1.0
        def get_discount_rate(beta, country):
            if "China" in country:
                if beta < 0.8: return 0.08
                if beta < 1.0: return 0.09
                if beta < 1.2: return 0.10
                return 0.11
            else:
                if beta < 0.8: return 0.054
                if beta < 0.95: return 0.057
                if beta < 1.05: return 0.060
                if beta < 1.15: return 0.063
                if beta < 1.25: return 0.066
                if beta < 1.35: return 0.069
                if beta < 1.45: return 0.072
                if beta < 1.55: return 0.075
                return 0.078
        discount_rate = get_discount_rate(beta_val, country)

        # Cash / Debt
        total_debt = 0
        cash_and_equivalents = 0
        if not balance_sheet.empty:
            total_debt = balance_sheet.loc["Total Debt"].iloc[0] if "Total Debt" in balance_sheet.index else 0
            if "Cash And Cash Equivalents" in balance_sheet.index:
                cash_and_equivalents = balance_sheet.loc["Cash And Cash Equivalents"].iloc[0]
            elif "Cash Cash Equivalents And Short Term Investments" in balance_sheet.index:
                cash_and_equivalents = balance_sheet.loc["Cash Cash Equivalents And Short Term Investments"].iloc[0]

        # --- 2. Define Calculation Methods ---
        results = []

        # Helper to get current values
        current_ni = net_income_series.iloc[0] if not net_income_series.empty else 0
        current_ocf = op_cash_flow_series.iloc[0] if not op_cash_flow_series.empty else 0
        
        def calculate_dcf_variant(base_val, name, metric_label):
            future_vals = []
            curr = base_val
            for _ in range(5): curr *= (1 + growth_rate_1_5); future_vals.append(curr)
            for _ in range(5): curr *= (1 + growth_rate_6_10); future_vals.append(curr)
            for _ in range(10): curr *= (1 + growth_rate_11_20); future_vals.append(curr)
            
            pv_sum = sum(v / ((1 + discount_rate)**(i+1)) for i, v in enumerate(future_vals))
            equity_val = pv_sum + cash_and_equivalents - total_debt
            iv = equity_val / shares_outstanding
            
            return {
                "method": name,
                "intrinsicValue": max(0, iv),
                "assumptions": {
                    f"Current {metric_label}": f"${base_val/1e9:.2f}B",
                    "Growth Rate (Yr 1-5)": f"{growth_rate_1_5*100:.2f}%",
                    "Growth Rate (Yr 6-10)": f"{growth_rate_6_10*100:.2f}%",
                    "Growth Rate (Yr 11-20)": f"{growth_rate_11_20*100:.2f}%",
                    "Discount Rate": f"{discount_rate*100:.2f}%",
                    "Beta": f"{beta_val:.2f}",
                    "Cash & Equivalents": f"${cash_and_equivalents/1e9:.2f}B",
                    "Total Debt": f"${total_debt/1e9:.2f}B",
                    "Shares Outstanding": f"{shares_outstanding/1e9:.2f}B",
                    "Growth Note": growth_note
                },
                "explanation": f"The {name} method is the gold standard for mature companies. It calculates the present value of all future cash the business is expected to generate."
            }

        # DCF Variants
        capex = 0
        if not cashflow.empty:
            if "Capital Expenditure" in cashflow.index: capex = abs(cashflow.loc["Capital Expenditure"].iloc[0])
            elif "Capital Expenditures" in cashflow.index: capex = abs(cashflow.loc["Capital Expenditures"].iloc[0])
        fcf = current_ocf - capex
        
        results.append(calculate_dcf_variant(fcf, "Discounted Free Cash Flow (DFCF)", "Free Cash Flow"))
        results.append(calculate_dcf_variant(current_ocf, "Discounted Operating Cash Flow (DOCF)", "Operating Cash Flow"))
        results.append(calculate_dcf_variant(current_ni, "Discounted Net Income (DNI)", "Net Income"))

        # PB Method
        book_value = info.get("bookValue")
        if not book_value and not balance_sheet.empty:
            equity = balance_sheet.loc["Stockholders Equity"].iloc[0] if "Stockholders Equity" in balance_sheet.index else 0
            book_value = equity / shares_outstanding
        
        mean_pb = info.get("priceToBook") or 1.5
        pb_iv = (book_value * mean_pb) if book_value else 0
        results.append({
            "method": "Mean Price-to-Book (PB)",
            "intrinsicValue": pb_iv,
            "assumptions": {
                "Current Book Value Per Share": f"${book_value:.2f}" if book_value else "N/A",
                "Assumed PB Ratio": f"{mean_pb:.2f}"
            },
            "explanation": "Preferred for Financials and Banks. Their value is primarily derived from their balance sheet assets rather than cash flow projections."
        })

        # PSG Method
        revenue_per_share = info.get("revenuePerShare") or ((revenue_series.iloc[0]/shares_outstanding) if not revenue_series.empty else 0)
        growth_rate_whole = growth_rate_1_5 * 100
        if revenue_estimates_data:
            for row in revenue_estimates_data:
                if row.get("period") == "+1y":
                    val = row.get("growth")
                    if val is not None: growth_rate_whole = float(val) * 100
                    break
        psg_iv = revenue_per_share * growth_rate_whole * 0.20
        results.append({
            "method": "Price to Sales Growth (PSG)",
            "intrinsicValue": psg_iv,
            "assumptions": {
                "Sales Per Share (TTM)": f"${revenue_per_share:.2f}",
                "Projected Sales Growth": f"{growth_rate_whole:.2f}%",
                "Fair PSG Constant": "0.20"
            },
            "explanation": "Best for high-growth tech companies with negative earnings. It values current sales momentum relative to future growth potential."
        })

        # Graham Number
        eps = info.get("trailingEps") or 0
        graham_iv = 0
        if eps > 0 and book_value and book_value > 0:
            graham_iv = math.sqrt(22.5 * eps * book_value)
        results.append({
            "method": "Graham Number",
            "intrinsicValue": graham_iv,
            "assumptions": {
                "Trailing EPS": f"${eps:.2f}",
                "Book Value Per Share": f"${book_value:.2f}" if book_value else "N/A",
                "Graham Multiplier": "22.5"
            },
            "explanation": "A conservative 'Margin of Safety' metric developed by Benjamin Graham. It identifies stocks that are trading at a low multiple of both earnings and book value."
        })

        # --- 3. Determine Recommended Method ---
        def is_consistent(series):
            if len(series) < 3: return False
            increases = sum(1 for i in range(len(series)-1) if series.iloc[i] >= series.iloc[i+1] * 0.9)
            return increases >= len(series) - 2

        rev_consistent = is_consistent(revenue_series)
        ni_consistent = is_consistent(net_income_series)
        ocf_consistent = is_consistent(op_cash_flow_series)
        
        rev_cagr = 0
        if len(revenue_series) >= 3:
            rev_cagr = (revenue_series.iloc[0] / revenue_series.iloc[-1])**(1/len(revenue_series)) - 1
        is_speculative = (rev_cagr > 0.15) and (current_ni < 0 or current_ocf < 0) and not is_financial

        recommended_name = "Discounted Free Cash Flow (DFCF)"
        if is_financial: recommended_name = "Mean Price-to-Book (PB)"
        elif is_speculative: recommended_name = "Price to Sales Growth (PSG)"
        else:
            if rev_consistent and ni_consistent and ocf_consistent:
                recommended_name = "Discounted Free Cash Flow (DFCF)" if current_ocf > 1.5 * current_ni else "Discounted Operating Cash Flow (DOCF)"
            elif rev_consistent and ni_consistent: recommended_name = "Discounted Net Income (DNI)"

        # Find the recommended result
        recommended = next((r for r in results if r["method"] == recommended_name), results[0])
        
        # --- 4. Finalize ---
        def clean_numeric(val):
            try:
                if math.isnan(val) or math.isinf(val): return 0
                return float(val)
            except: return 0

        # Create response
        diff_percent = ((current_price / recommended["intrinsicValue"]) - 1) if recommended["intrinsicValue"] > 0 else 0
        status = "Fairly Valued"
        if diff_percent > 0.15: status = "Overvalued"
        elif diff_percent < -0.15: status = "Undervalued"

        return {
            "method": recommended["method"],
            "intrinsicValue": recommended["intrinsicValue"],
            "currentPrice": current_price,
            "differencePercent": diff_percent,
            "status": status,
            "assumptions": recommended["assumptions"],
            "allMethods": results,
            "recommendedMethod": recommended["method"],
            "preferredMethodExplanation": recommended["explanation"],
            "raw_assumptions": {
                "base_value": clean_numeric(current_ocf), # Legacy
                "total_debt": clean_numeric(total_debt),
                "cash_and_equivalents": clean_numeric(cash_and_equivalents),
                "shares_outstanding": clean_numeric(shares_outstanding),
                "sales_per_share": clean_numeric(revenue_per_share),
                "book_value": clean_numeric(book_value)
            },
            "growthRateNext5Y": growth_rate_1_5,
            "growthNote": growth_note
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "Error", "intrinsicValue": 0, "method": "Error", "assumptions": {},
            "allMethods": [],
            "currentPrice": info.get("currentPrice") or info.get("regularMarketPrice") or 0,
            "growthNote": f"Exception: {str(e)}"
        }

def get_stock_data(ticker: str, force_refresh: bool = False):
    # --- PROPOSED CACHING LOGIC START ---
    try:
        if db and not force_refresh:
            cache_ref = db.collection('stock_cache').document(ticker)
            doc = cache_ref.get()
            
            if doc.exists:
                data = doc.to_dict()
                timestamp = data.get('timestamp')
                # Cache validity: 24 hours
                if timestamp and datetime.now(timezone.utc) - timestamp < timedelta(hours=24):
                    print(f"--- [SOURCE: FIREBASE] Returning CACHED data for {ticker} (Age: {datetime.now(timezone.utc) - timestamp})")
                    payload = data['payload']
                    
                    # --- HYBRID CACHE: Refresh Price Only ---
                    try:
                        # Fetch ONLY live price (fast operation, ~0.2s)
                        fast_stock = yf.Ticker(ticker)
                        # fast_info is much faster than .info
                        latest_price = fast_stock.fast_info.last_price 
                        
                        if latest_price:
                            # Update Price in Overview
                            if 'overview' in payload:
                                payload['overview']['price'] = latest_price
                            
                            # Update Top-level Price (if exists)
                            payload['currentPrice'] = latest_price
                            
                            # --- CHART PATCHING ---
                            # Patch Intraday Chart (for 1D view)
                            if 'intraday_history' in payload and isinstance(payload['intraday_history'], list):
                                current_time_str = datetime.now().strftime("%Y-%m-%d %H:%M")
                                payload['intraday_history'].append({
                                    "date": current_time_str,
                                    "close": latest_price
                                })
                            
                            # Patch Daily Chart (for 5Y view, prevents flatline at end)
                            if 'history' in payload and isinstance(payload['history'], list):
                                today_str = datetime.now().strftime("%Y-%m-%d")
                                # Check if today already exists to avoid dupes
                                if not payload['history'] or payload['history'][-1]['date'] != today_str:
                                    payload['history'].append({
                                        "date": today_str,
                                        "close": latest_price
                                    })
                                else:
                                    # Update today's close if it exists
                                    payload['history'][-1]['close'] = latest_price
                            # ----------------------

                            print(f"DEBUG: Updated cached {ticker} with live price: {latest_price}")
                    except Exception as p_e:
                        print(f"WARNING: Failed to update live price for cached {ticker}: {p_e}")
                    # ----------------------------------------
                    
                    # Mark source for frontend debugging
                    payload['_source'] = 'FIREBASE'
                    
                    # --- CACHE PATCH: Ensure 200MA is present ---
                    overview = payload.get('overview', {})
                    if 'twoHundredDayAverage' not in overview or overview['twoHundredDayAverage'] is None:
                        try:
                            history_list = payload.get('history', [])
                            if len(history_list) >= 200:
                                # history_list is [{date, close, ...}, ...]
                                # We need prices for the last 200 days
                                prices = [h['close'] for h in history_list if 'close' in h]
                                if len(prices) >= 200:
                                    ma200 = sum(prices[-200:]) / 200
                                    overview['twoHundredDayAverage'] = ma200
                                    print(f"DEBUG: Patched cached {ticker} with calculated 200MA: {ma200}")
                        except Exception as patch_e:
                            print(f"WARNING: Failed to patch 200MA for cached {ticker}: {patch_e}")
                    # --------------------------------------------

                    return payload
                else:
                    print(f"DEBUG: Cache expired for {ticker}, refreshing...")
            else:
                print(f"DEBUG: No cache found for {ticker}, fetching fresh...")
    except Exception as e:
        print(f"WARNING: Cache check failed for {ticker}: {e}")
    # --- PROPOSED CACHING LOGIC END ---

    try:
        start_time = time.time()
        print(f"\n--- [SOURCE: YFINANCE] START FETCHING DATA FOR {ticker} ---")
        
        stock = yf.Ticker(ticker)
        
        # Helper to map exchange codes
        def get_exchange_name(exchange_code):
            mapping = {
                "NMS": "NASDAQ", "NGM": "NASDAQ", "NCM": "NASDAQ",
                "NYQ": "NYSE", "ASE": "AMEX", "PNK": "OTC",
                "PCX": "NYSE Arca", "OPR": "Option",
            }
            return mapping.get(exchange_code, exchange_code)

        # Initialize fundamental variables
        calendar_data = {}
        news_data = []
        growth_estimates_data = []
        raw_growth_estimates_data = []
        revenue_estimates_data = []
        fund_start = time.time()
        
        financials = pd.DataFrame()
        balance_sheet = pd.DataFrame()
        cashflow = pd.DataFrame()
        history = pd.DataFrame()
        q_financials = pd.DataFrame()
        q_balance = pd.DataFrame()
        q_cashflow = pd.DataFrame()
        
        # Define tasks
        def fetch_prop(obj, name):
            t0 = time.time()
            res = None
            try:
                if hasattr(obj, name):
                    res = getattr(obj, name)
            except Exception:
                pass
            print(f"DEBUG: [Thread] {name} took {time.time() - t0:.2f}s")
            return res

        def fetch_method(obj, name, **kwargs):
            t0 = time.time()
            res = None
            try:
                if hasattr(obj, name):
                    res = getattr(obj, name)(**kwargs)
            except Exception:
                pass
            full_name = f"{name}"
            if kwargs: full_name += f" {kwargs}"
            print(f"DEBUG: [Thread] {full_name} took {time.time() - t0:.2f}s")
            return res
            
        future_results = {}
        
        # Start Parallel Fetch immediately (include INFO)
        f_start = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
            future_results = {
                "info": executor.submit(fetch_prop, stock, 'info'),
                "financials": executor.submit(fetch_prop, stock, 'financials'),
                "balance_sheet": executor.submit(fetch_prop, stock, 'balance_sheet'),
                "cashflow": executor.submit(fetch_prop, stock, 'cashflow'),
                "q_financials": executor.submit(fetch_prop, stock, 'quarterly_financials'),
                "q_balance_sheet": executor.submit(fetch_prop, stock, 'quarterly_balance_sheet'),
                "q_cashflow": executor.submit(fetch_prop, stock, 'quarterly_cashflow'),
                "calendar": executor.submit(fetch_prop, stock, 'calendar'),
                "news": executor.submit(fetch_prop, stock, 'news'),
                "revenue_estimate": executor.submit(fetch_prop, stock, 'revenue_estimate'),
                "growth_est_method": executor.submit(fetch_method, stock, 'get_growth_estimates'),
                "growth_est_prop": executor.submit(fetch_prop, stock, 'growth_estimates'),
                "raw_growth": executor.submit(fetch_method, stock, 'get_growth_estimates', as_dict=False),
                "history": executor.submit(fetch_method, stock, 'history', period="25y"),
            }
            
            # Wait for all to complete
            concurrent.futures.wait(future_results.values(), timeout=30)

        # Retrieve Results
        def get_res(key, default):
            if key not in future_results: return default
            try:
                res = future_results[key].result()
                return res if res is not None else default
            except Exception:
                return default

        info = get_res("info", {})
        
        # Validate if stock exists
        if not info or (info.get("currentPrice") is None and info.get("regularMarketPrice") is None):
            print(f"ERROR: Stock {ticker} not found or no price data")
            raise HTTPException(status_code=404, detail=f"Stock '{ticker}' not found or no data available.")

        # Build Overview
        quote_type = info.get("quoteType", "EQUITY")
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

        # Beta Fallback
        beta_val = overview["beta"]
        if beta_val is None:
            beta_val = info.get("beta3Year")
            if beta_val is None:
                beta_val = calculate_manual_beta(ticker)
        overview["beta"] = beta_val

        # Get Financials (fetched in parallel)
        financials = get_res("financials", pd.DataFrame())
        balance_sheet = get_res("balance_sheet", pd.DataFrame())
        cashflow = get_res("cashflow", pd.DataFrame())
        history = get_res("history", pd.DataFrame())
        
        q_financials = get_res("q_financials", pd.DataFrame())
        q_balance = get_res("q_balance_sheet", pd.DataFrame())
        q_cashflow = get_res("q_cashflow", pd.DataFrame())
        
        calendar_data = get_res("calendar", {})
        
        # Sanitize Calendar Data (Convert dates to strings for JSON/Firestore)
        if isinstance(calendar_data, dict):
            new_cal = {}
            for k, v in calendar_data.items():
                # Check for date/datetime objects (safe check using string type conversion or attribute)
                if hasattr(v, 'isoformat'):
                    new_cal[k] = v.isoformat()
                elif isinstance(v, list):
                    new_cal[k] = [x.isoformat() if hasattr(x, 'isoformat') else x for x in v]
                else:
                    new_cal[k] = v
            calendar_data = new_cal

        news_data = get_res("news", [])
            
        # Growth Estimates Logic
        ge = get_res("growth_est_method", None)
        if ge is None: ge = get_res("growth_est_prop", None)
        
        if ge is not None and not ge.empty:
            ge = ge.reset_index()
            if 'index' in ge.columns: ge = ge.rename(columns={'index': 'period'})
            elif 'Growth Estimates' in ge.columns: ge = ge.rename(columns={'Growth Estimates': 'period'})
            else:
                for col in ge.columns:
                    if 'period' in col.lower():
                        ge = ge.rename(columns={col: 'period'})
                        break
            growth_estimates_data = ge.to_dict(orient='records')

        # Raw Growth
        raw_ge = get_res("raw_growth", None)
        if raw_ge is not None and not raw_ge.empty:
            try:
                raw_ge.index.name = 'period'
                raw_growth_estimates_data = raw_ge.reset_index().to_dict(orient='records')
            except:
                pass
        
        # Revenue
        re = get_res("revenue_estimate", None)
        if re is not None and not re.empty:
            try:
                re.index.name = 'period'
                revenue_estimates_data = re.reset_index().to_dict(orient='records')
            except:
                pass

        print(f"DEBUG: Parallel fundamentals processed in {time.time() - f_start:.2f}s")
        
        # TTM Calculation (using fetched Q data)
        ttm_income = pd.Series()
        ttm_cashflow = pd.Series()
        ttm_balance = pd.Series()
        
        try:
            if not q_financials.empty and len(q_financials.columns) >= 4:
                ttm_income = q_financials.iloc[:, :4].sum(axis=1)
            
            if not q_cashflow.empty and len(q_cashflow.columns) >= 4:
                ttm_cashflow = q_cashflow.iloc[:, :4].sum(axis=1)
            
            if not q_balance.empty:
                ttm_balance = q_balance.iloc[:, 0]
        except Exception as e:
            print(f"Error calculating TTM data: {e}")

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
        # history fetched in parallel block
        # h_start = time.time()
        # history = stock.history(period="25y")  # DONE ABOVE
        # print(f"DEBUG: History (25y) fetched in {time.time() - h_start:.2f}s")
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
            "_source": "YFINANCE",
            "overview": {
                **overview, 
                "ceo": ceo,
                "twoHundredDayAverage": float(history["SMA_200"].iloc[-1]) if "SMA_200" in history.columns and not history["SMA_200"].dropna().empty else info.get("twoHundredDayAverage")
            },
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
        
        # --- CACHE SAVE ---
        try:
            if db:
                db.collection('stock_cache').document(ticker).set({
                    'timestamp': datetime.now(timezone.utc),
                    'payload': final_response
                })
                print(f"DEBUG: Saved fresh data for {ticker} to cache.")
        except Exception as e:
            print(f"WARNING: Failed to save cache for {ticker}: {e}")
        # ------------------

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
    comparison_tickers: List[str] = []

@app.post("/api/portfolio/twr")
async def get_portfolio_twr(payload: PortfolioTWRRequest):
    items = payload.items
    uid = payload.uid
    
    print(f"--- [API] Calculating Portfolio TWR for {len(items)} items ---")
    
    # --- Caching Logic ---
    # Generate a hash of the input items to detect ANY changes (edits/adds/deletes)
    # We stringify the sorted items to ensure consistency
    import hashlib
    items_str = json.dumps({
        "items": [item.dict() for item in items],
        "comparison_tickers": payload.comparison_tickers
    }, sort_keys=True, default=str)
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
    result = await calculate_portfolio_twr(items, payload.comparison_tickers)
    
    # Process for JSON safety (NaN -> None)
    result = clean_nan(result)

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

async def calculate_portfolio_twr(items: List[PortfolioItem], comparison_tickers: List[str] = []):
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
        # Always start at least 1 day before the first transaction to show the 0 point
        start_date = min_date - pd.Timedelta(days=1)
        end_date = pd.Timestamp.now().normalize()
        all_dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # 2. Fetch Adjusted History (Total Return)
        # Fetch 7 days prior to capture Friday close for weekend/holiday purchases
        fetch_start = min_date - pd.Timedelta(days=7)
        print(f"DEBUG: Fetching history from {fetch_start.strftime('%Y-%m-%d')}")
        history_map = {}
        ticker_currencies = {}
        
        all_fetch_tickers = processed_tickers.union(set(comparison_tickers))
        
        for ticker in all_fetch_tickers:
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

        # Ticker Level Loops
        ticker_states = {t: {'shares': 0.0, 'twr': 1.0, 'v_prev': 0.0} for t in processed_tickers}
        comp_starts = {t: None for t in comparison_tickers}
        comp_last_prices = {t: 0.0 for t in comparison_tickers}
        
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
            entry = {
                "date": date.strftime("%Y-%m-%d"),
                "value": (portfolio_twr - 1) * 100
            }

            # Comparison Tickers
            for ct in comparison_tickers:
                price = 0.0
                if ct in history_map and not history_map[ct].empty:
                    if date in history_map[ct].index:
                        price = history_map[ct].loc[date]
                        comp_last_prices[ct] = price
                    elif comp_last_prices[ct] > 0:
                        price = comp_last_prices[ct]
                    else:
                        try:
                            idx = history_map[ct].index.get_indexer([date], method='pad')[0]
                            if idx != -1:
                                price = history_map[ct].iloc[idx]
                                comp_last_prices[ct] = price
                        except:
                            pass
                
                if price > 0:
                    if comp_starts[ct] is None:
                        comp_starts[ct] = price
                    entry[f"val_{ct}"] = (price / comp_starts[ct] - 1) * 100
                elif comp_starts[ct] is not None:
                    # If we had a start but no current price, use last known growth
                    entry[f"val_{ct}"] = (comp_last_prices[ct] / comp_starts[ct] - 1) * 100 if comp_last_prices[ct] > 0 else 0

            chart_data.append(entry)

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
            "YTD": {"fetch_period": "1y", "interval": "1d", "display_points": None},  # User requested 1 year duration
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
            # Filter to year-to-date (Changed to 1Y per request)
            # Just use the fetched period (1y) directly
            pass 
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
async def read_stock(ticker: str, refresh: bool = False):
    print(f"\n--- [API] Received request for {ticker} (Refresh: {refresh}) ---")
    data = get_stock_data(ticker, force_refresh=refresh)
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
    models_to_try = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-flash-latest", "gemini-pro-latest"]
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
    items: list
    metrics: dict
    uid: Optional[str] = None
    forceRefresh: bool = False
    portfolioId: str = 'main'

@app.post("/api/portfolio/analyze")
async def analyze_portfolio(request: PortfolioAnalysisRequest):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not found in environment variables.")

    # --- Caching Logic ---
    if db and request.uid and not request.forceRefresh:
        try:
            # Sanitize and Determine correct document
            pid = request.portfolioId.strip() if request.portfolioId else ''
            is_main = pid in ['main', 'latest', '', 'null', 'None']
            
            print(f"DEBUG ANALYSIS: Received ID='{request.portfolioId}', Cleaned='{pid}', is_main={is_main}")

            if is_main:
                doc_ref = db.collection('users').document(request.uid)
            else:
                doc_ref = db.collection('users').document(request.uid).collection('test_portfolios').document(pid)
            
            doc = doc_ref.get()
            
            if doc.exists:
                data = doc.to_dict()
                # Check if analysis exists and is fresh
                analysis_text = data.get('analysis')
                ts = data.get('analysis_timestamp')
                
                if analysis_text and ts:
                    if hasattr(ts, 'timestamp'):
                        delta = datetime.now(timezone.utc) - ts
                    else:
                        try:
                            ts_dt = datetime.fromisoformat(str(ts))
                            delta = datetime.now(timezone.utc) - ts_dt
                        except:
                            delta = timedelta(hours=999)

                    if delta < timedelta(hours=24):
                        print(f"DEBUG: Returning Cached Analysis for {request.portfolioId}")
                        return {"analysis": analysis_text}
        except Exception as e:
            print(f"Analysis Cache Read Error: {e}") 

    # --- End Cache Check ---

    # --- Consolidated Analysis Loop ---
    current_allocations = {}
    total_value = 0
    user_sector_totals = {}
    list_of_valuation_results = []
    
    # Calculate total value first (since we need it for percentages in the prompt)
    for item_raw in request.items:
        total_value += item_raw.get('totalCost', 0)

    for item_raw in request.items:
        ticker = item_raw.get('ticker')
        shares = item_raw.get('shares', 0)
        cost = item_raw.get('totalCost', 0)
        
        try:
            # get_stock_data uses Firestore caching and is MUCH faster than yf.Ticker(t).info
            data = get_stock_data(ticker)
            overview = data.get("overview", {})
            val_data = data.get("valuation", {})
            raw_assumptions = val_data.get("raw_assumptions", {})
            
            # Sector tracking
            sector = overview.get('sector', 'Other')
            user_sector_totals[sector] = user_sector_totals.get(sector, 0) + cost
            
            # Valuation metrics for prompt
            peg = overview.get("pegRatio")
            peg_str = f"{peg:.2f}" if peg is not None else "N/A"
            
            beta = overview.get("beta")
            beta_str = f"{beta:.2f}" if beta is not None else "N/A"
            
            growth_5y = val_data.get("growthRateNext5Y", 0)
            growth_5y_str = f"{growth_5y*100:.1f}%" if growth_5y else "N/A"
            
            cash = raw_assumptions.get("cash_and_equivalents", 0)
            debt = raw_assumptions.get("total_debt", 0)
            cash_to_debt = "N/A"
            if isinstance(cash, (int, float)) and isinstance(debt, (int, float)):
                if debt > 0: cash_to_debt = f"{cash / debt:.2f}"
                elif cash > 0: cash_to_debt = "High (Net Cash)"
            
            ma200 = overview.get("twoHundredDayAverage")
            price = val_data.get("currentPrice", 0)
            ma_status = "N/A"
            if ma200 and price:
                ma_status = "Uptrend (Above 200MA)" if price > ma200 else "Downtrend (Below 200MA)"

            list_of_valuation_results.append({
                "ticker": ticker,
                "shares": shares,
                "intrinsicValue": val_data.get("intrinsicValue", 0),
                "currentPrice": price,
                "status": val_data.get("status", "Unknown"),
                "peg": peg_str,
                "beta": beta_str,
                "growth_5y": growth_5y_str,
                "cash_to_debt": cash_to_debt,
                "ma_status": ma_status
            })
        except Exception as e:
            print(f"Error fetching data for {ticker} for analysis: {e}")
            list_of_valuation_results.append({
                "ticker": ticker,
                "shares": shares,
                "intrinsicValue": 0, "currentPrice": 0, "status": "Error",
                "peg": "N/A", "beta": "N/A", "growth_5y": "N/A", "cash_to_debt": "N/A"
            })

    # Prepare Context Strings
    if total_value > 0:
        sector_allocation_str = ", ".join([f"{s}: {(v/total_value)*100:.1f}%" for s, v in user_sector_totals.items()])
    else:
        sector_allocation_str = "N/A"
        
    user_sector_names = set(user_sector_totals.keys())
    missing = [s for s in MAJOR_SECTORS if s not in user_sector_names]
    underweight_sectors = ", ".join(missing[:4]) if missing else "None"

    holdings_str = "\n".join([
        f"- {res['ticker']}: {res['shares']} shares. "
        f"(Intrinsic Value: ${res['intrinsicValue']:.2f}, "
        f"Current Price: ${res['currentPrice']:.2f}, "
        f"Status: {res['status']}, "
        f"PEG: {res['peg']}, "
        f"Beta: {res['beta']}, "
        f"5Y Growth Est: {res['growth_5y']}, "
        f"Cash/Debt: {res['cash_to_debt']}, "
        f"Momentum: {res.get('ma_status', 'N/A')})" 
        for res in list_of_valuation_results
    ])
    performance = request.metrics.get('totalTwr', 'N/A')
    # Enrichment from your metrics dictionary
    sector_context = request.metrics.get('sectorAllocation', 'N/A')
    performance = request.metrics.get('totalTwr', 'N/A')
    missing_sectors = request.metrics.get('underweightSectors', 'Defensive or Emerging Markets')

    prompt = f"""
    You are a Senior Quantitative Portfolio Manager and Fiduciary Strategist specializing in "Quality Growth" (GARP) mandates.
    
    MANDATE: 
    Optimize this portfolio for a 12-15% annual return (CAGR) over a 5-10 year horizon. Prioritize "Business Quality" and "Valuation Discipline" over simple price volatility.
    
    PORTFOLIO DATA CORE (Inward):
    {holdings_str}
    - Weighted Portfolio Beta: {request.metrics.get('weightedBeta', 'N/A')}
    - Aggregate 5Y Growth Est: {request.metrics.get('weightedGrowth', 'N/A')}%
    - Portfolio TWR (Performance to Date): {performance}%
    - Sector Allocation: {sector_allocation_str}
    - Portfolio HHI (Concentration Index): {request.metrics.get('portfolioHHI', 'N/A')}
    
    ADAM KHOO’S 7-STEP QUALITY FILTER:
    1. Consistent Growth: 5-10 year track record of increasing Revenue, Net Income, Gross Profit Margins, Net Profit Margins,and Operating Cash Flow.
    2. Wide Economic Moat: High Brand Power, Network Effect, or High Switching Costs.
    3. Future Growth Drivers: Clear management catalyst for the next 5-10 years.
    4. Operational Efficiency: ROE > 15% and ROIC > 12% consistently.
    5. Conservative Debt: Debt-to-EBITDA < 3.0 and high Cash-to-Debt ratio, debt servicing ratio < 30%, Current Ratio > 1, declining Cash Conversion Cycle, Sales Revenue is greater than Accounts Receivables 
    6. Valuation: Price must be at or below Intrinsic Value (PEG < 1.5 preferred) and have reached a support level.
    7. Momentum: Stock must be in a Stage 2 Uptrend (Price > 200-day MA).

    OUTWARD LOOK (The Opportunity Set):
    - Benchmark: S&P 500 (10% CAGR) vs. Nasdaq-100 (15% CAGR).
    - Underweight Sectors: {underweight_sectors}
    - Risk-Free Rate Proxy (10Y Treasury): ~4.2%
    - Target Return: 12-15% CAGR (High-conviction growth focus).

    ANALYSIS REQUIREMENTS (Clinical & Data-Driven & Long-Term Compounding & Future Potential):
    1. **Allocation & Concentration Audit**: 
       - Evaluate the Sector Allocation and the Portfolio HHI. Is the portfolio "top-heavy" or over-concentrated in a few names or sectors? 
       - Identify "Single Point of Failure" risks. If one ticker or one sector accounts for >25% of the portfolio, flag it as a critical risk regardless of performance.
       - Assess if the weighted growth target is being skewed by 1-2 volatile tickers.
    
    2. **The Quality-Growth Filter (The "Moat" Test)**: 
       - Apply the 15% ROE and <3.0 Debt-to-EBITDA filter strictly to all holdings. 
       - Identify "Value Traps": Tickers that look cheap but have declining margins or excessive debt.
       - Flag "Growth at any Price" (GAAP) risks where PEG > 1.5. In Khoo’s VMI, we do not overpay for "hype."

    3. **Engine vs. Anchor (VMI Selection)**: 
        - **ENGINES (The Queens)**: Refer to the "ADAM KHOO’S 7-STEP QUALITY FILTER" section for criteria.
       - **ANCHORS (The Junk)**: Stocks that does not pass "ADAM KHOO’S 7-STEP QUALITY FILTER" criteria.

    4. **Selection Basis for Underweight Sectors**: 
       - Criteria: Define 4 non-negotiable VMI criteria (e.g., ROE > 15%, Debt-to-EBITDA < 2.5, Wide Moat, and Positive FCF Yield) to ensure new entries contribute to the 15% CAGR target.
       - Define 4 non-negotiable criteria for new entries in {underweight_sectors} to ensure they contribute to the 15% target (e.g., Pricing Power, Net Debt/EBITDA < 2.0).
       - Specify exactly what criteria (e.g., "Positive FCF Yield," "ROIC > 15%," "Strong Pricing Power," or "Wide Economic Moat", or "Low Debt-to-EBITDA") the user should look for to hit 12-15% growth safely over the long term.
       - List 5 "Institutional Quality" peer alternatives (e.g., MSFT, GOOGL, MA, COST style) currently showing price strength.

    5. **Actionable Rebalancing Roadmap**: 
       - **Trim/Exit Recommendation**:Trim winners only if they exceed 15% weight. Exit any position where the Moat is breached or Debt-to-EBITDA exceeds 3.0.
       - **Tactical Entry Strategy**: Instruction on buying the dip *only* if the stock remains in a Stage 2 Uptrend.
       - **Optimization Moves**: 3 moves to shift capital from "Anchors" to "Engines" to reach the 15% CAGR frontier.

    FORMAT RULES:
    - **DO NOT use markdown headers (like # or ##).** Use **bold** text for section titles instead.
    - Use standard bullet points (-) for list items. 
    - **INDENT sub-points** (nested bullets) by 2 spaces to ensure they are visually distinct and not aligned with the main bullet.
    - Ensure all text size and formatting is consistent and professional.
    - Use bullet points for all details. 
    - Ensure all text size and text format are consistent. 
    - Keep it under 400 words.
    """
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }
    
    models_to_try = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-flash-latest", "gemini-pro-latest"]
    
    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            response = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=30)
            response.raise_for_status()
            result = response.json()
             
            if "candidates" in result and result["candidates"]:
                text = result["candidates"][0]["content"]["parts"][0]["text"]
                
                # --- Save to Cache (within test portfolio doc) ---
                if db and request.uid:
                    try:
                        pid = request.portfolioId.strip() if request.portfolioId else ''
                        is_main = pid in ['main', 'latest', '', 'null', 'None']
                        
                        if is_main:
                            doc_ref = db.collection('users').document(request.uid)
                        else:
                            doc_ref = db.collection('users').document(request.uid).collection('test_portfolios').document(pid)
                        
                        doc_ref.set({
                            'analysis': text,
                            'analysis_timestamp': datetime.now(timezone.utc)
                        }, merge=True)
                        print(f"DEBUG: Saved Analysis to {pid}")
                    except Exception as e:
                        print(f"Analysis Cache Write Error: {e}")
                
                return {"analysis": text}
                
        except Exception as e:
            if 'response' in locals() and response is not None:
                try:
                    error_details = response.json()
                    print(f"Gemini Analysis Error Detail ({model}): {json.dumps(error_details)}")
                except:
                    print(f"Gemini Analysis Error Body ({model}): {response.text}")
            print(f"Gemini Analysis Error ({model}): {e}")
            last_exception = e
            continue

    raise HTTPException(status_code=500, detail="Failed to generate analysis.")

# --- User Settings Endpoints ---

class UserSettings(BaseModel):
    settings: dict

@app.post("/api/settings/{uid}")
async def save_user_settings(uid: str, payload: UserSettings):
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Merge with existing settings or overwrite? Usually merge is safer for partial updates
        # But for simplicity, we can just set/merge.
        doc_ref = db.collection('users').document(uid).collection('settings').document('preferences')
        print(f"DEBUG: Writing to users/{uid}/settings/preferences: {payload.settings}")
        doc_ref.set(payload.settings, merge=True)
        print("DEBUG: Write successful")
        return {"status": "success", "settings": payload.settings}
    except Exception as e:
        print(f"Error saving settings for {uid}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/settings/{uid}")
async def get_user_settings_endpoint(uid: str):
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        doc_ref = db.collection('users').document(uid).collection('settings').document('preferences')
        doc = doc_ref.get()
        if doc.exists:
            return doc.to_dict()
        return {}
    except Exception as e:
        print(f"Error fetching settings for {uid}: {e}")
        return {}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)