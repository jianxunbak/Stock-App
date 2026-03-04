import yfinance as yf
ticker = yf.Ticker("AAPL")
print("FAST INFO:", ticker.fast_info.keys())
print("BETA:", ticker.fast_info.get("beta"))
print("SECTOR:", getattr(ticker.fast_info, 'sector', 'N/A'))
