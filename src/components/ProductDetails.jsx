import { formatCurrency } from "../utils/helpers";

export default function ProductDetails({
  product,
  onBack,
  onOpenAR,
}) {
  if (!product) {
    return null;
  }

  return (
    <section className="overlay-shell">
      <div className="overlay-card product-details">
        <button type="button" className="close-button" onClick={onBack} aria-label="Close product details">
          ×
        </button>

        <div className="detail-media">
          <img src={product.image_url} alt={product.name} className="detail-image" />
        </div>

        <div className="detail-copy">
          <span className="eyebrow">Product Details</span>
          <h2>{product.name}</h2>
          <p className="detail-price">{formatCurrency(product.price)}</p>
          <p className="detail-description">{product.description}</p>

          <div className="detail-grid">
            <div>
              <span className="label">Material</span>
              <strong>{product.material_composition}</strong>
            </div>
            <div>
              <span className="label">Fit</span>
              <strong>{product.fit}</strong>
            </div>
          </div>

          <div className="detail-section">
            <span className="label">Available sizes</span>
            <div className="swatch-row">
              {product.sizes.map((size) => (
                <span key={size} className="mini-pill mini-pill-dark">
                  {size}
                </span>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <span className="label">Available colors</span>
            <div className="swatch-row">
              {product.colors.map((color) => (
                <span key={color} className="mini-pill">
                  {color}
                </span>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <span className="label">Why this pick</span>
            <p className="muted-copy">{product.recommendationReason || product.reason}</p>
          </div>

          <div className="detail-actions detail-actions-single">
            <button type="button" className="primary-button" onClick={() => onOpenAR(product)}>
              Preview
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
