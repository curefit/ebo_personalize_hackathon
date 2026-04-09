import { useEffect, useState } from "react";
import { formatCurrency } from "../utils/helpers";

const loadedImageUrls = new Set();

export default function ProductGrid({
  recommendations,
  shopperProfile,
  onOpenDetails,
  onOpenAR,
}) {
  const [loadedImages, setLoadedImages] = useState(() => new Set(loadedImageUrls));

  useEffect(() => {
    recommendations.forEach((product) => {
      if (!product.image_url || loadedImageUrls.has(product.image_url)) {
        return;
      }

      const image = new Image();
      image.src = product.image_url;
      image.onload = () => {
        loadedImageUrls.add(product.image_url);
        setLoadedImages(new Set(loadedImageUrls));
      };
    });
  }, [recommendations]);

  return (
    <section className="browse-layout">
      <div className="browse-header">
        <div className="browse-heading">
          <span className="eyebrow">Recommendations</span>
          <h2>Picked for you</h2>
          <p>Matched to your fit and fabric preference. Explore tees and a few complementary performance products.</p>
        </div>

        <div className="profile-inline">
          <span className="mini-pill mini-pill-dark">Fit: {shopperProfile.preferred_fit}</span>
          <span className="mini-pill">Material: {shopperProfile.material_preference}</span>
        </div>
      </div>

      <div className="product-grid">
        {recommendations.map((product) => (
          <article key={product.id} className="product-card" onClick={() => onOpenDetails(product)} role="button">
            <div className="product-image-shell">
              <img
                src={product.image_url}
                alt={product.name}
                className={`product-image ${loadedImages.has(product.image_url) ? "is-loaded" : ""}`}
                loading="eager"
                decoding="sync"
                onLoad={() => {
                  loadedImageUrls.add(product.image_url);
                  setLoadedImages(new Set(loadedImageUrls));
                }}
              />
              <div className="product-tag">{product.category}</div>
            </div>

            <div className="product-copy">
              <div className="product-copy-row">
                <h3>{product.name}</h3>
                <strong>{formatCurrency(product.price)}</strong>
              </div>

              <p className="product-reason">{product.recommendationReason}</p>

              <div className="product-meta-row">
                <span className="mini-pill mini-pill-dark">Fit: {product.fit}</span>
                <span className="mini-pill mini-pill-dark">Material: {product.material_tag}</span>
                <span className="mini-pill">{product.colors.length} colors</span>
              </div>
            </div>

            <div className="card-actions">
              <button
                type="button"
                className="primary-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenAR(product);
                }}
              >
                Preview
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
