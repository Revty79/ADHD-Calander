import { guideSections } from "../../src/features/guide/guideContent";

export default function WebGuideScreen() {
  return (
    <div className="web-page web-shared-page">
      <header className="web-page-header">
        <div>
          <p className="web-eyebrow">Guide</p>
          <h1>How it works</h1>
          <p>A quick guide to the features that are available now.</p>
        </div>
      </header>
      <div className="web-guide-grid">
        {guideSections.map((section) => (
          <section className="web-detail-panel" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.summary}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
