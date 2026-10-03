export const mountExport = (root: HTMLElement): void => {
  root.innerHTML = `
    <div class="models">
      <header class="models-head">
        <div>
          <h1 class="page-title">Export</h1>
          <p class="models-sub">Share or convert your models</p>
        </div>
      </header>
      <p class="model-status">Exporting isn't implemented yet — later you'll publish to Hugging Face and convert to GGUF here.</p>
    </div>`;
};
