import yfinance as yf
import pandas as pd

ticker = "AAPL"
stock = yf.Ticker(ticker)
try:
    re = stock.revenue_estimates
    if re is not None:
        print("Revenue Estimates Index:", re.index)
        print("Revenue Estimates Columns:", re.columns)
        print(re)
        
        # Simulate what I do in main.py
        re_reset = re.reset_index()
        print("\nReset Index Columns:", re_reset.columns)
        print(re_reset.to_dict(orient='records'))
    else:
        print("No revenue estimates found.")
except Exception as e:
    print(e)
