"""LM SuperApp Python backend — placeholder.

Future home of finetuning and other Python-powered features.
The Electron app will spawn this as a child process and talk to it
over stdin/stdout (JSON lines) or a local HTTP port — TBD.
"""

# TODO(protocol): pick the IPC — JSON-lines over stdio or a localhost HTTP server
# TODO(finetune): LoRA training entrypoint (unsloth/TRL), dataset → adapter
# TODO(finetune): emit progress events (step/loss/eta) the Finetune tab can poll
# TODO(export): merge adapter + quantize to GGUF via llama.cpp scripts
# TODO(media): image/video generation backends land here too


def main() -> None:
    print("LM SuperApp backend — nothing here yet.")


if __name__ == "__main__":
    main()
