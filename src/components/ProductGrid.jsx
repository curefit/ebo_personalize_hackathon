import { formatCurrency } from "../utils/helpers";

export default function ProductGrid({ title, subtitle, products, onOpenDetails, onOpenAR, emptyCopy, className = "" }) {
  const sectionClassName = `catalog-section ${className}`.trim();

  if (!products?.length) {
    return (
      <section className={sectionClassName}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Rack view</span>
            <h2>{title}</h2>
            <p>{emptyCopy || "No products matched the current brief."}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={sectionClassName}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Rack view</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="catalog-grid">
        {products.map((product) => (
          <article key={product.id} className="catalog-item">
            <button type="button" className="catalog-media" onClick={() => onOpenDetails(product)}>
              <img src={product.image_url} alt={product.name} className="catalog-image" loading="lazy" decoding="async" />
            </button>

            <div className="catalog-copy">
              <div className="catalog-copy-top">
                <div>
                  <span className="catalog-kicker">{product.category}</span>
                  <h3>{product.name}</h3>
                </div>
                <strong>{formatCurrency(product.price)}</strong>
              </div>

              <p className="catalog-reason">{product.recommendationReason || product.reason || product.description}</p>

              <div className="catalog-meta">
                <span>{product.fit}</span>
                <span>{product.material_tag}</span>
                <span>{product.availabilityLabel}</span>
              </div>
            </div>

            <div className="catalog-actions">
              <button type="button" className="ghost-button" onClick={() => onOpenDetails(product)}>
                Details
              </button>
              <button type="button" className="primary-button" onClick={() => onOpenAR(product)}>
                Try on
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
