import yfinance as yf
stock = yf.Ticker("AAPL")
try:
    re = stock.revenue_estimate
    print("Revenue Estimate Index:", re.index)
    print("Revenue Estimate Columns:", re.columns)
    print(re)
    
    re_reset = re.reset_index()
    print("\nReset Index Columns:", re_reset.columns)
    print(re_reset.to_dict(orient='records'))
except Exception as e:
    print(e)
