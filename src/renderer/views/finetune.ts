//TODO(finetune): dataset picker, base model select, LoRA params, live progress — driven by src/backend
export const mountFinetune = (root: HTMLElement): void => {
  root.innerHTML = `
    <div class="models">
      <header class="models-head">
        <div>
          <h1 class="page-title">Finetune</h1>
          <p class="models-sub">Train your own model on your data</p>
        </div>
      </header>
      <p class="model-status">Finetuning isn't implemented yet — this tab is a placeholder.</p>
    </div>`;
};
