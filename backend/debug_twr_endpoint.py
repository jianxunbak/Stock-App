import requests
import json

def test_twr_endpoint():
    url = "http://localhost:8000/api/portfolio/twr"
    
    # Mock Portfolio Data
    # 10 shares of AAPL bought at 150 (approx 2023)
    payload = [
        {
            "id": "1",
            "ticker": "AAPL",
            "shares": 10,
            "totalCost": 1500, # $150/share
            "date": "2023-01-01"
        },
        {
            "id": "2",
            "ticker": "NVDA",
            "shares": 5,
            "totalCost": 500, # $100/share (old price)
            "date": "2023-01-01"
        }
    ]
    
    print(f"Sending POST to {url} with {len(payload)} items...")
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_twr_endpoint()
