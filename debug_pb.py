import yfinance as yf
import pandas as pd

ticker = "AAPL"
stock = yf.Ticker(ticker)

print("--- Balance Sheet Index ---")
print(stock.balance_sheet.index)

print("\n--- Financials (Income Stmt) Index ---")
print(stock.financials.index)

print("\n--- History Head ---")
hist = stock.history(period="5y")
print(hist.head())

print("\n--- Calculating Historical PB ---")
# Try to calculate
bs = stock.balance_sheet
fin = stock.financials

# Equity
if "Stockholders Equity" in bs.index:
    equity = bs.loc["Stockholders Equity"]
    print("\nEquity:\n", equity)
else:
    print("Stockholders Equity not found")

# Shares
if "Basic Average Shares" in fin.index:
    shares = fin.loc["Basic Average Shares"]
    print("\nShares:\n", shares)
else:
    print("Basic Average Shares not found")

# If we have both
if "Stockholders Equity" in bs.index and "Basic Average Shares" in fin.index:
    bvps = equity / shares
    print("\nBVPS:\n", bvps)
    
    # Get price for these dates
    pbs = []
    for date, val in bvps.items():
        # Find closest price
        # date is Timestamp
        try:
            # history index is DatetimeIndex, usually timezone aware?
            # bs dates are usually timezone naive?
            # Let's handle timezone
            ts = pd.Timestamp(date)
            if ts.tz is None:
                ts = ts.tz_localize("UTC")
            
            # Find price on or before this date
            # Actually balance sheet date is end of period.
            # We should take the close price of that date.
            
            # Need to align timezones. stock.history usually returns localized.
            hist_tz = hist.index.tz
            if hist_tz is not None:
                ts = ts.tz_convert(hist_tz)
            
            # Lookup
            # Use asof or get_loc with method='pad' (backward fill)
            idx = hist.index.get_indexer([ts], method='pad')[0]
            if idx != -1:
                price = hist.iloc[idx]['Close']
                pb = price / val
                print(f"Date: {date.date()}, Price: {price:.2f}, BVPS: {val:.2f}, PB: {pb:.2f}")
                pbs.append(pb)
        except Exception as e:
            print(f"Error for date {date}: {e}")

    if pbs:
        print("\nAverage PB:", sum(pbs)/len(pbs))
