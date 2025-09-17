import streamlit as st
import requests
import pandas as pd
import time

# ... your functions fetch_markets(), is_listed_on_coinbase(), load_data() here ...

st.title("Coinbase Coins Momentum Ranking")
st.write("Weighted Score = 50% 1h + 30% 24h + 20% 30d")

# Refresh button clears cache
if st.button("Refresh Data"):
    st.cache_data.clear()

# ⬇️ Only call load_data() here, after the UI is loaded
with st.spinner("Loading data from CoinGecko..."):
    df = load_data()

# Sorting options
sort_col = st.selectbox(
    "Sort by:",
    ["score", "market_cap", "p1h %", "p24h %", "p30d %", "price", "name"]
)

ascending = st.checkbox("Sort ascending?", value=False)

df_sorted = df.sort_values(sort_col, ascending=ascending)

st.dataframe(df_sorted.reset_index(drop=True))