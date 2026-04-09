export default function StockAvailability({ product, inventory, loading, error, onClose }) {
  if (!product) {
    return null;
  }

  return (
    <section className="overlay-shell overlay-right">
      <div className="overlay-card stock-panel">
        <button type="button" className="close-button" onClick={onClose} aria-label="Close stock panel">
          ×
        </button>

        <span className="eyebrow">Stock Availability</span>
        <h2>{product.name}</h2>
        <p className="muted-copy">Current store, nearby store, and online inventory in one view.</p>

        {loading ? <p className="loading-copy">Loading live inventory...</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        {!loading && inventory ? (
          <div className="stock-sections">
            <div className="stock-card">
              <div className="stock-card-header">
                <div>
                  <h3>{inventory.currentStore.store_name}</h3>
                  <p>Current location</p>
                </div>
                <strong>{inventory.currentStore.totalQuantity} units</strong>
              </div>
              <div className="stock-pills">
                {inventory.currentStore.items.map((item) => (
                  <span key={`${item.size}-${item.color}`} className="stock-pill">
                    {item.size} / {item.color} · {item.quantity}
                  </span>
                ))}
              </div>
            </div>

            <div className="stock-card">
              <div className="stock-card-header">
                <div>
                  <h3>Nearby stores</h3>
                  <p>Closest matching inventory</p>
                </div>
              </div>

              <div className="nearby-list">
                {inventory.nearbyStores.map((store) => (
                  <div key={store.store_id} className="nearby-row">
                    <div>
                      <strong>{store.store_name}</strong>
                      <p>{store.distance_km} km away</p>
                    </div>
                    <span>{store.totalQuantity} units</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="stock-card">
              <div className="stock-card-header">
                <div>
                  <h3>Online delivery</h3>
                  <p>Ship-to-home option</p>
                </div>
                <strong>{inventory.online.available ? "Available" : "Unavailable"}</strong>
              </div>
              <p className="muted-copy">Estimated delivery: {inventory.online.eta}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
