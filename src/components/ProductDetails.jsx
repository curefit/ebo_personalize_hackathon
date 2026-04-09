import { formatCurrency } from "../utils/helpers";

export default function ProductDetails({ product, onBack, onOpenAR }) {
  if (!product) {
    return null;
  }

  return (
    <section className="overlay-shell">
      <div className="overlay-card detail-panel">
        <button type="button" className="close-button" onClick={onBack} aria-label="Close product details">
          ×
        </button>

        <div className="detail-layout">
          <div className="detail-media">
            <img src={product.image_url} alt={product.name} className="detail-image" />
          </div>

          <div className="detail-copy">
            <span className="eyebrow">Product detail</span>
            <h2>{product.name}</h2>
            <p className="detail-price">{formatCurrency(product.price)}</p>
            <p className="detail-description">{product.description}</p>

            <div className="detail-facts">
              <div>
                <span className="label">Fit</span>
                <strong>{product.fit}</strong>
              </div>
              <div>
                <span className="label">Fabric</span>
                <strong>{product.material_composition || product.material}</strong>
              </div>
              <div>
                <span className="label">Activity</span>
                <strong>{product.activity}</strong>
              </div>
            </div>

            <div className="detail-stack">
              <div>
                <span className="label">Why it made the rack</span>
                <p className="muted-copy">{product.recommendationReason || product.reason}</p>
              </div>

              <div>
                <span className="label">Available sizes</span>
                <div className="token-row">
                  {product.sizes?.map((size) => (
                    <span key={size} className="mini-pill mini-pill-dark">
                      {size}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="label">Available colors</span>
                <div className="token-row">
                  {product.colors?.map((color) => (
                    <span key={color} className="mini-pill">
                      {color}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="detail-actions">
              <button type="button" className="ghost-button" onClick={onBack}>
                Back
              </button>
              <button type="button" className="primary-button" onClick={() => onOpenAR(product)}>
                Open try-on
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
