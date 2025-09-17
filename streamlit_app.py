import streamlit as st

# --- Streamlit UI ---
st.title("Coinbase Coins Momentum Ranking")
st.write("Weighted Score = 50% 1h + 30% 24h + 20% 30d")

if st.button("Refresh Data"):
    st.cache_data.clear()

df = load_data()

# Sorting options
sort_col = st.selectbox(
    "Sort by:",
    ["score", "market_cap", "p1h %", "p24h %", "p30d %", "price", "name"]
)

ascending = st.checkbox("Sort ascending?", value=False)

df_sorted = df.sort_values(sort_col, ascending=ascending)

st.dataframe(df_sorted.reset_index(drop=True))