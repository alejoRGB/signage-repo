import requests
import time
import sys

BASE_URL = "http://localhost:3000/api"

def test_rate_limit():
    print("\n--- Testing Rate Limit (device/register) ---")
    url = f"{BASE_URL}/device/register"
    
    # Send 10 requests rapidly
    for i in range(1, 11):
        try:
            response = requests.post(url)
            print(f"Request {i}: Status {response.status_code}")
            if response.status_code == 429:
                print("✅ Rate limit triggered successfully!")
                return True
        except Exception as e:
            print(f"Request failed: {e}")
        time.sleep(0.1)
    
    print("❌ Rate limit NOT triggered (expected 429 after 5 requests)")
    return False

if __name__ == "__main__":
    print(f"Target: {BASE_URL}")
    success_rl = test_rate_limit()
    
    if success_rl:
        print("\n✅ Security Verification PASSED")
        sys.exit(0)
    else:
        print("\n❌ Security Verification FAILED")
        sys.exit(1)
